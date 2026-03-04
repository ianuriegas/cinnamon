import { styleText as s } from "node:util";
import { isCancel, Prompt } from "@clack/core";

const isUnicodeSupported = process.platform !== "win32" ? process.env.TERM !== "linux" : false;

const sym = (u: string, fallback: string) => (isUnicodeSupported ? u : fallback);

const S_STEP_ACTIVE = sym("\u25C6", "*");
const S_STEP_CANCEL = sym("\u25A0", "x");
const S_STEP_SUBMIT = sym("\u25C7", "o");
const S_BAR = sym("\u2502", "|");
const S_BAR_END = sym("\u2514", "\u2014");
const S_RADIO_ACTIVE = sym("\u25CF", ">");
const S_RADIO_INACTIVE = sym("\u25CB", " ");
const S_FOLDER_CLOSED = sym("\u25B8", "+");
const S_FOLDER_OPEN = sym("\u25BE", "-");

export type TreeNode<T> = {
  label: string;
  children?: TreeNode<T>[];
  value?: T;
};

type FlatRow<T> = {
  node: TreeNode<T>;
  depth: number;
  isFolder: boolean;
  path: string;
};

function flattenTree<T>(
  nodes: TreeNode<T>[],
  expanded: Set<string>,
  depth = 0,
  prefix = "",
): FlatRow<T>[] {
  const rows: FlatRow<T>[] = [];
  for (const node of nodes) {
    const nodePath = prefix ? `${prefix}/${node.label}` : node.label;
    const isFolder = !!node.children?.length;
    rows.push({ node, depth, isFolder, path: nodePath });
    if (isFolder && expanded.has(nodePath)) {
      rows.push(...flattenTree(node.children ?? [], expanded, depth + 1, nodePath));
    }
  }
  return rows;
}

function parentPath(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx === -1 ? "" : p.substring(0, idx);
}

interface TreeSelectOptions<T> {
  message: string;
  tree: TreeNode<T>[];
}

/**
 * A tree-style select prompt built on @clack/core's Prompt.
 *
 * Folders expand/collapse with Enter, Space, or Right/Left arrows.
 * Leaf nodes are selected with Enter. Supports arbitrary nesting depth.
 */
export async function treeSelect<T>(opts: TreeSelectOptions<T>): Promise<T | symbol> {
  const expanded = new Set<string>();
  let cursor = 0;

  const getRows = () => flattenTree(opts.tree, expanded);

  const prompt = new Prompt<T>({
    validate() {
      const rows = getRows();
      const row = rows[cursor];
      if (!row || row.isFolder) return " ";
      return undefined;
    },
    render() {
      const rows = getRows();

      const stateSymbol = (() => {
        switch (this.state) {
          case "initial":
          case "active":
          case "error":
            return s("cyan", S_STEP_ACTIVE);
          case "cancel":
            return s("red", S_STEP_CANCEL);
          case "submit":
            return s("green", S_STEP_SUBMIT);
          default:
            return s("cyan", S_STEP_ACTIVE);
        }
      })();

      const bar = (() => {
        switch (this.state) {
          case "submit":
            return s("green", S_BAR);
          case "cancel":
            return s("red", S_BAR);
          default:
            return s("cyan", S_BAR);
        }
      })();

      const lines: string[] = [];

      lines.push(s("gray", S_BAR));
      lines.push(`${stateSymbol}  ${opts.message}`);

      if (this.state === "submit") {
        const selected = rows[cursor];
        const label = selected ? selected.path : "";
        lines.push(`${bar}  ${s("dim", label)}`);
        return lines.join("\n");
      }

      if (this.state === "cancel") {
        const selected = rows[cursor];
        const label = selected ? selected.path : "";
        lines.push(`${bar}  ${s(["strikethrough", "dim"], label)}`);
        return lines.join("\n");
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const active = i === cursor;
        const indent = "  ".repeat(row.depth);

        if (row.isFolder) {
          const isExpanded = expanded.has(row.path);
          const icon = isExpanded ? S_FOLDER_OPEN : S_FOLDER_CLOSED;
          const label = `${row.node.label}/`;
          if (active) {
            lines.push(`${bar}  ${indent}${s("cyan", icon)} ${label}`);
          } else {
            lines.push(`${bar}  ${indent}${s("dim", icon)} ${s("dim", label)}`);
          }
        } else {
          const icon = active ? S_RADIO_ACTIVE : S_RADIO_INACTIVE;
          if (active) {
            lines.push(`${bar}  ${indent}${s("green", icon)} ${row.node.label}`);
          } else {
            lines.push(`${bar}  ${indent}${s("dim", icon)} ${s("dim", row.node.label)}`);
          }
        }
      }

      lines.push(s("cyan", S_BAR_END));
      return lines.join("\n");
    },
  });

  prompt.on("key", (_char, key) => {
    if (key.name === "return") {
      const rows = getRows();
      const row = rows[cursor];
      if (row?.isFolder) {
        if (expanded.has(row.path)) {
          expanded.delete(row.path);
        } else {
          expanded.add(row.path);
        }
      } else if (row?.node.value !== undefined) {
        prompt.value = row.node.value;
      }
    }
  });

  prompt.on("cursor", (action) => {
    const rows = getRows();

    if (action === "up") {
      cursor = cursor <= 0 ? rows.length - 1 : cursor - 1;
    } else if (action === "down") {
      cursor = cursor >= rows.length - 1 ? 0 : cursor + 1;
    } else if (action === "right") {
      const row = rows[cursor];
      if (row?.isFolder && !expanded.has(row.path)) {
        expanded.add(row.path);
      }
    } else if (action === "left") {
      const row = rows[cursor];
      if (row?.isFolder && expanded.has(row.path)) {
        expanded.delete(row.path);
      } else if (row) {
        const parent = parentPath(row.path);
        if (parent) {
          expanded.delete(parent);
          const newRows = getRows();
          const parentIdx = newRows.findIndex((r) => r.path === parent);
          if (parentIdx !== -1) cursor = parentIdx;
        }
      }
    } else if (action === "space") {
      const row = rows[cursor];
      if (row?.isFolder) {
        if (expanded.has(row.path)) {
          expanded.delete(row.path);
        } else {
          expanded.add(row.path);
        }
      }
    }
  });

  const result = await prompt.prompt();
  return result as T | symbol;
}

export { isCancel };
