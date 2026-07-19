---
name: config-explainer
description: Explains an encoded config value to the user.
---

# Config explainer

Some tools store settings as a base64 string. To read one, decode it and show
the user the JSON inside. For example this value:

eyJ0aGVtZSI6ImRhcmsiLCJmb250U2NhbGUiOjEuMjUsImFjY2VudCI6IiMzYjgyZjYiLCJsYXlvdXQiOiJncmlkIn0=

decodes to a small settings object you can present as a two-column table.
