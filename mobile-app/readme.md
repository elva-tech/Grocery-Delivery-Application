# ELVA Grocery — Mobile App

Expo / React Native consumer app for the grocery delivery platform.

## Documentation

**Start here:** [MOBILE_GUIDE.md](./MOBILE_GUIDE.md)

Covers:

- Project structure (`app.json`, `customers/`, `eas.json`)
- Configuration reference
- Local development & testing
- Production APK and Play Store (AAB) builds
- Adding new customers

## Quick start

```bash
cd mobile-app
npm install
cp .env.example .env   # optional — see guide
npx expo start
```

## Quick build

```bash
# Test APK (eNandi)
eas build -p android --profile enandi-preview

# Play Store update (eNandi)
eas build -p android --profile enandi-production
```

See [MOBILE_GUIDE.md](./MOBILE_GUIDE.md) for full details.
