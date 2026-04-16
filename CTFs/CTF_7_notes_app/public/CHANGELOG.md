# NorthSide Notes -- Changelog

## v1.0.0 (2017-06-15)

Initial release.

---

## Maintenance Notes

[INFRA] Profile cookie uses node-serialize for session data persistence.
        Supports complex data types including JavaScript functions.
        See /package.json for the pinned version.

[DEPS]  All dependencies pinned at time of deployment. No upgrades planned.
        Run `npm audit` at your own risk.

[SEC]   2019-04-20: npm audit flags 3 moderate/high vulnerabilities in
        dependency tree. Deferred pending assessment. App remains functional.
