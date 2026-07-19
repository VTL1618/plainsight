# Security policy

## Reporting a vulnerability in plainsight

Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). Do not open a public issue. You will get an acknowledgment within a week, and credit in the release notes unless you prefer otherwise.

## When our tooling finds a problem in someone else's project

Wide scans and corpus curation sometimes surface what looks like a real injection or exfiltration attempt in a third-party skill or config. The rule for those cases:

1. The file never enters this repository, and any aggregate report stays free of names and content.
2. The maintainer of the affected project is contacted privately through their own security policy, or GitHub private reporting on their repository.
3. Nothing is published here until the maintainer has had a reasonable window to respond and remediate. 90 days is the default.

A scanner that publicly flags named projects it has never spoken to is doing harm, not security. We do not do that.
