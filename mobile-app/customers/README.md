# Customers folder

One folder per Play Store customer. Each customer needs at minimum a `config.json`; optional branding assets can live in the same folder.

**Full documentation:** [../MOBILE_GUIDE.md](../MOBILE_GUIDE.md)

## Quick example

```
customers/enandi/
├── config.json
├── icon.png          (optional)
├── adaptive-icon.png (optional)
└── splash.png        (optional)
```

## Build

```bash
eas build -p android --profile enandi-production
```

EAS sets `CUSTOMER=enandi` → `app.config.js` loads this folder.
