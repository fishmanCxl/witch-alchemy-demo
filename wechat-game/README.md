# Witch Water Sort — Cocos Creator production client

Open this folder with Cocos Creator 3.8.8. The first runnable scene is `assets/scenes/Main.scene`; open it and press Preview to test the home-to-level flow.

The production client is split into:

- `assets/scripts/core`: framework-free TypeScript rules and versioned data models;
- `assets/scripts/presentation`: Cocos components and animation choreography;
- `assets/scripts/platform`: WeChat storage, ads, lifecycle, network, and CloudBase adapters;
- `assets/resources/game`: synchronized approved runtime art/audio/config assets.

Run the core rules without Cocos:

```powershell
node --experimental-strip-types --test tests/water-sort.test.ts tests/production-contracts.test.ts tests/scene-flow.test.ts
```

Do not commit CloudBase environment IDs or WeChat secrets. They are injected through build/deployment configuration.
