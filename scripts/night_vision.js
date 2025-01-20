//import { GURPS } from "../module/config.js";
let NightVisionAdvantageName ='Night*Vision'; //  name of the advantage to check
let DarkVisionAdvantageName ='Dark*Vision'; //  name of the advantage to check
let nightVisionLevelMultiplier = 1;
let advantageLevel = 0;
let hasNightVisionAdvantage = false;
let hasDarkVisionAdvantage = false;
let hasNightVisionActive = false;
let hasDarkVisionActive = false;
let advantageObject = {};

/**
 * The vision mode for GURPS Darkvision.
 */
class VisionModeGurpsDarkvision extends VisionMode {
    constructor() {
        super({
            id: "gurpsDarkvision",
            label: "GURPS.SenseDarkvision",
            canvas: {
                shader: ColorAdjustmentsSamplerShader,
                uniforms: { contrast: 0, saturation: -1, exposure: 0 },
            },
            vision: {
                darkness: { adaptive: false },
                defaults: { contrast: 0, saturation: -1, brightness: 0.1 },
            },
        });
    }
}

Hooks.once("init", () => {
    CONFIG.AmbientLight.objectClass = mixin(CONFIG.AmbientLight.objectClass);
    CONFIG.Token.objectClass = mixin(CONFIG.Token.objectClass);

    // Add the new VisionMode to CONFIG.Canvas.visionModes
    CONFIG.Canvas.visionModes.gurpsDarkvision = new VisionModeGurpsDarkvision();
});

Hooks.on('init', () => {
    game.settings.register("gurps-night-vision", "onlyOnSelection", {
        name: "Night Vision requires selection",
        hint: "With this setting on, players must select a token to see with Night Vision",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: () => {
            // Refresh canvas sight
            canvas.perception.update(
                { initializeLighting: true, initializeVision: true, refreshLighting: true, refreshVision: true },
                true
            );
        },
    });

    game.settings.register("gurps-night-vision", "nightVisionDistance", {
        name: "Night Vision multiplier",
        hint: "Modifies the light multiplier granted per level of Night Vision (1-9). Recommended setting is 2 or 3. Default is 3.",
        scope: "world",
        config: true,
        default: 3,
        type: Number,
        step: "any",
        onChange: () => {
            // Refresh canvas sight
            canvas.perception.update(
                { initializeLighting: true, initializeVision: true, refreshLighting: true, refreshVision: true },
                true
            );
        },
    });

    game.settings.register("gurps-night-vision", "nightVisionBright", {
        name: "Night Vision affects bright illumination",
        hint: "With this setting on, Night Vision also increases the radius of bright illumination by half the value of dim illumination.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: () => {
            // Refresh canvas sight
            canvas.perception.update(
                { initializeLighting: true, initializeVision: true, refreshLighting: true, refreshVision: true },
                true
            );
        },
    });
});

//define the values that calculate the Nightvision multiplier, and make them 0 so they don't introduce undefined into the calculation
let multiplier = { dim: 0, bright: 0 };
let nightVisionDistance = 0;
let gridUnitPixels = 0;

const mixin = Base => class extends Base {
    /** @override */
    _getLightSourceData() {
        const data = super._getLightSourceData();
        if (data.negative === true && data.disabled === false && hasDarkVisionActive === true) {
			console.log (`---  DARKNESS:  Dark Vision active, and this light emits Darkness, so setting radius to 0;`);
			data.dim = 0;
			data.bright = 0;
			data.radius = 0;
        } else if (data.negative === false && multiplier.dim > 1 && hasNightVisionActive === true ) {
            data.dim += multiplier.dim * nightVisionDistance * gridUnitPixels;
        } 

        if (game.settings.get("gurps-night-vision", "nightVisionBright")) {
            if (data.negative === false && hasNightVisionActive === true && multiplier.bright > 1 ) {
                data.bright += multiplier.bright * nightVisionDistance / 2 * gridUnitPixels;
            }
        }
        return data;
    }
};

const visionCalculator = async function () {
    multiplier = { dim: 0, bright: 0 }; //reset multiplier to 0 (erases previous values)
    const gmSelection = game.user.isGM || game.settings.get("gurps-night-vision", "onlyOnSelection");
    const controlledtoken = canvas.tokens.controlled;
    let relevantTokens; // define which tokens with which to calculate Night Vision settings.

    if (controlledtoken.length) {
        relevantTokens = canvas.tokens.placeables.filter(
            (o) =>
                !!o.actor && o.actor?.testUserPermission(game.user, "OBSERVER") && o.controlled
        );
    } else {
        relevantTokens = canvas.tokens.placeables.filter(
            (o) =>
                !!o.actor && o.actor?.testUserPermission(game.user, "OBSERVER") && (gmSelection ? o.controlled : true)
        );
    }

    if (gmSelection && relevantTokens.length) {
        multiplier = { dim: 999, bright: 999 };
		hasNightVisionAdvantage = false;
		hasDarkVisionAdvantage = false;
		hasNightVisionActive = false;
		hasDarkVisionActive = false;

        for (const t of relevantTokens) {
            hasNightVisionAdvantage = GURPS.findAdDisad(t.actor,NightVisionAdvantageName) ? true : false;
            hasDarkVisionAdvantage = GURPS.findAdDisad(t.actor,DarkVisionAdvantageName) ? true : false;
            console.log(`Checking selected token(s) for Night Vision and Dark Vision: ${t.name}`);

            if (t.actor.flags.DarkVisionSpell && t.actor.flags.DarkVisionSpell === true) {
                console.log(`Has Dark Vision spell: ${t.actor.flags.DarkVisionSpell}`);
                hasDarkVisionActive = true;
                await t.document.update({"sight.visionMode": "gurpsDarkvision", "sight.range": 1000});
                await t.vision.visionMode.updateSource({"id": "gurpsDarkvision", "label": "GURPS.SenseDarkvision"});
                await t.document.update({"vision.blinded.darkness": false});

                if (t.document.sight.visionMode.id !== "gurpsDarkvision") {
                    console.log(`Has Dark Vision advantage (${hasDarkVisionAdvantage}), so try setting visionMode=gurpsDarkvision`);
                    await t.document.update({"sight.visionMode": "gurpsDarkvision", "sight.range": 1000});
                    await t.vision.visionMode.updateSource({"id": "gurpsDarkvision", "label": "GURPS.SenseDarkvision"});
                    await t.document.update({"vision.blinded.darkness": false});
                }
            } else if (hasDarkVisionAdvantage === true) {
                console.log(`Has Dark Vision advantage (${hasDarkVisionAdvantage});`);
                hasDarkVisionActive = true;
                await t.document.update({"sight.visionMode": "gurpsDarkvision", "sight.range": 1000});
                await t.vision.visionMode.updateSource({"id": "gurpsDarkvision", "label": "GURPS.SenseDarkvision"});
                await t.document.update({"vision.blinded.darkness": false});

                if (t.document.sight.visionMode.id !== "gurpsDarkvision") {
                    console.log(`Has Dark Vision advantage (${hasDarkVisionAdvantage}), so try setting visionMode=gurpsDarkvision`);
                    await t.document.update({"sight.visionMode": "gurpsDarkvision", "sight.range": 1000});
                    await t.vision.visionMode.updateSource({"id": "gurpsDarkvision", "label": "GURPS.SenseDarkvision"});
                    await t.document.update({"vision.blinded.darkness": false});
                }
            } else if (t.actor.flags.NightVisionSpell && t.actor.flags.NightVisionSpell > 0) {
                hasNightVisionActive = true;
                nightVisionDistance = game.settings.get("gurps-night-vision", "nightVisionDistance");
                advantageLevel = t.actor.flags.NightVisionSpell;
                nightVisionLevelMultiplier = advantageLevel * nightVisionDistance;
                console.log(`token: ${t.actor.name}; has Night Vision spell active; actor.flags.NightVisionSpell: ${t.actor.flags.NightVisionSpell}; spell Level: ${advantageLevel} ; nightVisionLevelMultiplier: ${nightVisionLevelMultiplier};`);
                multiplier.dim = Math.min(multiplier.dim, nightVisionLevelMultiplier);
                multiplier.bright = Math.min(multiplier.bright, nightVisionLevelMultiplier);
            } else if (hasNightVisionAdvantage === true) {
                hasNightVisionActive = true;
                advantageObject = GURPS.findAdDisad(t.actor,NightVisionAdvantageName) ? GURPS.findAdDisad(t.actor,NightVisionAdvantageName) : {};
                let advantageName = advantageObject.name ? advantageObject.name: '';
                const match = advantageName.match(/\d+$/);
                if (match) {
                    advantageLevel = parseInt(match[0], 10);
                    console.log(`advantageLevel: ${advantageLevel} `);
                    nightVisionDistance = game.settings.get("gurps-night-vision", "nightVisionDistance");
                    nightVisionLevelMultiplier = advantageLevel * nightVisionDistance;
                    console.log(`nightVisionLevelMultiplier: ${nightVisionLevelMultiplier};`);
                }
                multiplier.dim = Math.min(multiplier.dim, nightVisionLevelMultiplier);
                multiplier.bright = Math.min(multiplier.bright, nightVisionLevelMultiplier);
            } else {
                hasNightVisionActive = false;
                hasDarkVisionActive = false;
                console.log(`token: ${t.actor.name}; does not have Night Vision advantage, so no light multiplier`);
                multiplier.dim = 1;
                multiplier.bright = 1;
                nightVisionDistance = 1;
            }
            console.log(`multiplier.dim: ${multiplier.dim};`);
        }
    } else {
        multiplier = { dim: 1, bright: 1 };
		hasNightVisionAdvantage = false;
		hasDarkVisionAdvantage = false;
		hasNightVisionActive = false;
		hasDarkVisionActive = false;

        for (const t of relevantTokens) {
            hasNightVisionAdvantage = GURPS.findAdDisad(t.actor,NightVisionAdvantageName) ? true : false;
            hasDarkVisionAdvantage = GURPS.findAdDisad(t.actor,DarkVisionAdvantageName) ? true : false;
            console.log(`Checking selected token(s) for Night Vision and Dark Vision: ${t.name}`);

            if (t.actor.flags.DarkVisionSpell && t.actor.flags.DarkVisionSpell === true) {
                console.log(`Has Dark Vision spell: ${t.actor.flags.DarkVisionSpell}`);
                hasDarkVisionActive = true;
                await t.document.update({"sight.visionMode": "gurpsDarkvision", "sight.range": 1000});
                await t.vision.visionMode.updateSource({"id": "gurpsDarkvision", "label": "GURPS.SenseDarkvision"});
                await t.document.update({"vision.blinded.darkness": false});

                if (t.document.sight.visionMode.id !== "gurpsDarkvision") {
                    console.log(`Has Dark Vision advantage (${hasDarkVisionAdvantage}), so try setting visionMode=gurpsDarkvision`);
                    await t.document.update({"sight.visionMode": "gurpsDarkvision", "sight.range": 1000});
                    await t.vision.visionMode.updateSource({"id": "gurpsDarkvision", "label": "GURPS.SenseDarkvision"});
                    await t.document.update({"vision.blinded.darkness": false});
                }
            } else if (hasDarkVisionAdvantage === true) {
                console.log(`Has Dark Vision advantage (${hasDarkVisionAdvantage});`);
                hasDarkVisionActive = true;
                await t.document.update({"sight.visionMode": "gurpsDarkvision", "sight.range": 1000});
                await t.vision.visionMode.updateSource({"id": "gurpsDarkvision", "label": "GURPS.SenseDarkvision"});
                await t.document.update({"vision.blinded.darkness": false});

                if (t.document.sight.visionMode.id !== "gurpsDarkvision") {
                    console.log(`Has Dark Vision advantage (${hasDarkVisionAdvantage}), so try setting visionMode=gurpsDarkvision`);
                    await t.document.update({"sight.visionMode": "gurpsDarkvision", "sight.range": 1000});
                    await t.vision.visionMode.updateSource({"id": "gurpsDarkvision", "label": "GURPS.SenseDarkvision"});
                    await t.document.update({"vision.blinded.darkness": false});
                }
            } else if (t.actor.flags.NightVisionSpell && t.actor.flags.NightVisionSpell > 0) {
                hasNightVisionActive = true;
                nightVisionDistance = game.settings.get("gurps-night-vision", "nightVisionDistance");
                advantageLevel = t.actor.flags.NightVisionSpell;
                nightVisionLevelMultiplier = advantageLevel * nightVisionDistance;
                console.log(`token: ${t.actor.name}; has Night Vision spell active; actor.flags.NightVisionSpell: ${t.actor.flags.NightVisionSpell}; spell Level: ${advantageLevel} ; nightVisionLevelMultiplier: ${nightVisionLevelMultiplier};`);
                multiplier.dim = Math.min(multiplier.dim, nightVisionLevelMultiplier);
                multiplier.bright = Math.min(multiplier.bright, nightVisionLevelMultiplier);
            } else if (hasNightVisionAdvantage === true) {
				hasNightVisionActive = true;
                let advantageObject = GURPS.findAdDisad(t.actor,NightVisionAdvantageName) ? GURPS.findAdDisad(t.actor,NightVisionAdvantageName) : {};
                let advantageName = advantageObject.name ? advantageObject.name: '';
                const match = advantageName.match(/\d+$/);
                if (match) {
                    advantageLevel = parseInt(match[0], 10);
                    console.log(`advantageLevel: ${advantageLevel} `);
                    nightVisionDistance = game.settings.get("gurps-night-vision", "nightVisionDistance");
                    nightVisionLevelMultiplier = advantageLevel * nightVisionDistance;
                    console.log(`nightVisionLevelMultiplier: ${nightVisionLevelMultiplier};`);
                }
                multiplier.dim = Math.max(multiplier.dim, nightVisionLevelMultiplier);
                multiplier.bright = Math.max(multiplier.bright, nightVisionLevelMultiplier);
            } else {
                console.log(`token: ${t.actor.name}; does not have Night Vision advantage, so no light multiplier`);
                multiplier.dim = 1;
                multiplier.bright = 1;
                nightVisionDistance = 1;
            }
        }
    }

    gridUnitPixels = game.scenes.viewed.dimensions.distancePixels;

    for (const { object } of canvas.effects.lightSources) {
        if (!((object instanceof AmbientLight) || (object instanceof Token))) continue;
        object.initializeLightSource();
    }
	for (const { object } of canvas.effects.darknessSources) {
        if (!((object instanceof AmbientLight) || (object instanceof Token))) continue;
        object.initializeLightSource();
    }
};

const Debouncer = foundry.utils.debounce(visionCalculator, 10);

Hooks.on("controlToken", () => {
    Debouncer();
});