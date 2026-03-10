import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  highestRole,
  Permission,
  roleHasPermission,
  type TeamRoleValue,
} from "@/src/auth/permissions.ts";

describe("roleHasPermission", () => {
  test("admin has all team-level permissions", () => {
    assert.equal(roleHasPermission("admin", Permission.RUNS_VIEW), true);
    assert.equal(roleHasPermission("admin", Permission.RUNS_TRIGGER), true);
    assert.equal(roleHasPermission("admin", Permission.RUNS_CANCEL), true);
    assert.equal(roleHasPermission("admin", Permission.TEAMS_MANAGE), true);
  });

  test("admin does not have USERS_MANAGE (super-admin only)", () => {
    assert.equal(roleHasPermission("admin", Permission.USERS_MANAGE), false);
  });

  test("member has view, trigger, and cancel", () => {
    assert.equal(roleHasPermission("member", Permission.RUNS_VIEW), true);
    assert.equal(roleHasPermission("member", Permission.RUNS_TRIGGER), true);
    assert.equal(roleHasPermission("member", Permission.RUNS_CANCEL), true);
  });

  test("member cannot manage teams or users", () => {
    assert.equal(roleHasPermission("member", Permission.TEAMS_MANAGE), false);
    assert.equal(roleHasPermission("member", Permission.USERS_MANAGE), false);
  });

  test("viewer has only view permission", () => {
    assert.equal(roleHasPermission("viewer", Permission.RUNS_VIEW), true);
    assert.equal(roleHasPermission("viewer", Permission.RUNS_TRIGGER), false);
    assert.equal(roleHasPermission("viewer", Permission.RUNS_CANCEL), false);
    assert.equal(roleHasPermission("viewer", Permission.TEAMS_MANAGE), false);
    assert.equal(roleHasPermission("viewer", Permission.USERS_MANAGE), false);
  });
});

describe("highestRole", () => {
  test("returns null for empty array", () => {
    assert.equal(highestRole([]), null);
  });

  test("returns single role", () => {
    assert.equal(highestRole(["viewer"]), "viewer");
    assert.equal(highestRole(["member"]), "member");
    assert.equal(highestRole(["admin"]), "admin");
  });

  test("picks admin over member", () => {
    assert.equal(highestRole(["member", "admin"]), "admin");
  });

  test("picks admin over viewer", () => {
    assert.equal(highestRole(["viewer", "admin"]), "admin");
  });

  test("picks member over viewer", () => {
    assert.equal(highestRole(["viewer", "member"]), "member");
  });

  test("picks admin from all three roles", () => {
    assert.equal(highestRole(["viewer", "member", "admin"]), "admin");
  });

  test("handles duplicates", () => {
    assert.equal(highestRole(["viewer", "viewer", "member"]), "member");
  });
});

describe("permission matrix consistency", () => {
  const roles: TeamRoleValue[] = ["admin", "member", "viewer"];
  const permValues = Object.values(Permission);

  test("every role has at least RUNS_VIEW", () => {
    for (const role of roles) {
      assert.equal(
        roleHasPermission(role, Permission.RUNS_VIEW),
        true,
        `${role} should have RUNS_VIEW`,
      );
    }
  });

  test("USERS_MANAGE is not granted to any team role", () => {
    for (const role of roles) {
      assert.equal(
        roleHasPermission(role, Permission.USERS_MANAGE),
        false,
        `${role} should NOT have USERS_MANAGE`,
      );
    }
  });

  test("higher roles have a superset of lower role permissions", () => {
    for (const perm of permValues) {
      if (roleHasPermission("viewer", perm)) {
        assert.equal(roleHasPermission("member", perm), true, `member should have ${perm}`);
        assert.equal(roleHasPermission("admin", perm), true, `admin should have ${perm}`);
      }
      if (roleHasPermission("member", perm)) {
        assert.equal(roleHasPermission("admin", perm), true, `admin should have ${perm}`);
      }
    }
  });
});

import { _validateConfig } from "@/config/load-config.ts";

describe("config teams validation", () => {
  test("accepts valid teams array", () => {
    const config = _validateConfig({
      jobs: {
        "my-job": { command: "echo", teams: ["itops", "finance"] },
      },
    });
    assert.deepEqual(config.jobs["my-job"].teams, ["itops", "finance"]);
  });

  test("accepts job without teams", () => {
    const config = _validateConfig({
      jobs: {
        "my-job": { command: "echo" },
      },
    });
    assert.equal(config.jobs["my-job"].teams, undefined);
  });

  test("rejects non-array teams", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", teams: "itops" } } }),
      /teams.*must be an array/i,
    );
  });

  test("rejects empty string in teams array", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", teams: ["itops", ""] } } }),
      /teams.*must be an array of non-empty/i,
    );
  });

  test("rejects non-string values in teams array", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", teams: [123] } } }),
      /teams.*must be an array of non-empty/i,
    );
  });
});
