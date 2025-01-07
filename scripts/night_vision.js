let NightVisionAdvantageName ='Night*Vision'; //  name of the advantage to check
let nightVisionLevelMultiplier = 1;
let advantageLevel = 0;
let hasNightVisionAdvantage = false;
let advantageObject = {};

Hooks.once("init", () => {
	CONFIG.AmbientLight.objectClass = mixin(CONFIG.AmbientLight.objectClass);
	CONFIG.Token.objectClass = mixin(CONFIG.Token.objectClass);
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

//This is where the magic happens
const mixin = Base => class extends Base {
	/** @override */
	_getLightSourceData() {
		const data = super._getLightSourceData();

		//if (this.document instanceof AmbientLight) return data;
		if (multiplier.dim > 1 ) {
			data.dim += multiplier.dim * nightVisionDistance * gridUnitPixels;
		} 

		if (game.settings.get("gurps-night-vision", "nightVisionBright")) {
			if (multiplier.dim > 1 ) {
				data.bright += multiplier.bright * nightVisionDistance / 2 * gridUnitPixels;
			}
		}
		return data;
	}
};

const visionCalculator = function () {
	multiplier = { dim: 0, bright: 0 }; //reset multiplier to 0 (erases previous values)
	const gmSelection = game.user.isGM || game.settings.get("gurps-night-vision", "onlyOnSelection");
	const controlledtoken = canvas.tokens.controlled;
	let relevantTokens; // define which tokens with which to calculate Night Vision settings.

	/* 
	If a player has a token controlled, only define Night Vision based on those tokens.
	If a player does not control a token, define Night Vision based on all their tokens.
	GMs only define Night Vision based on tokens controlled.
	*/
	if (controlledtoken.length) {//if a token controlled, collect all tokens that you are controlling that you have vision for
		relevantTokens = canvas.tokens.placeables.filter(
			(o) =>
				!!o.actor && o.actor?.testUserPermission(game.user, "OBSERVER") && o.controlled
		);
	} else { //if no tokens controlled, then check all tokens for which you have vision. this doesn't apply for GM
		relevantTokens = canvas.tokens.placeables.filter(
			(o) =>
				!!o.actor && o.actor?.testUserPermission(game.user, "OBSERVER") && (gmSelection ? o.controlled : true)
		);
	};

	if (gmSelection && relevantTokens.length) {
		// GM mode: only sees Night Vision if 100% selected tokens have Night Vision (and only the worst).
		// At least one token must be selected for Night Vision to trigger (otherwise it's default foundry behaviour).
		multiplier = { dim: 999, bright: 999 };

		for (const t of relevantTokens) {
			//const tokenVision = t.actor.items.filter(i => i.name.includes(game.i18n.localize("NAME.NightVision")));
			//multiplier.dim = Math.min(multiplier.dim, tokenVision.length);
			//multiplier.bright = Math.min(multiplier.bright, tokenVision.length);

			// test
			//let multiplier = { dim: 999, bright: 999 };
			//console.log(`token: ${t.actor.name}; t.document.sight.range: ${t.document.sight.range};`);	
			//let NightVisionAdvantageName ='Night*Vision'; //  name of the advantage to check
			//let advantageLevel = 0;
			let hasNightVisionAdvantage = GURPS.findAdDisad(t.actor,NightVisionAdvantageName) ? true : false;
			if (t.actor.flags.NightVisionSpell && t.actor.flags.NightVisionSpell > 0) {
				nightVisionDistance = game.settings.get("gurps-night-vision", "nightVisionDistance"); // distance per level of Night Vision
				advantageLevel = t.actor.flags.NightVisionSpell;
				nightVisionLevelMultiplier = advantageLevel*nightVisionDistance;
				console.log(`token: ${t.actor.name}; has Night Vision spell active; actor.flags.NightVisionSpell: ${t.actor.flags.NightVisionSpell}; spell Level: ${advantageLevel} ; nightVisionLevelMultiplier: ${nightVisionLevelMultiplier};`);
				multiplier.dim = Math.min(multiplier.dim, nightVisionLevelMultiplier);
				multiplier.bright = Math.min(multiplier.bright, nightVisionLevelMultiplier);
			} else if (hasNightVisionAdvantage === true) {
				let advantageObject = GURPS.findAdDisad(t.actor,NightVisionAdvantageName) ? GURPS.findAdDisad(t.actor,NightVisionAdvantageName) : {};
				let advantageName = advantageObject.name ? advantageObject.name: '';
				const match = advantageName.match(/\d+$/); // \d+ matches one or more digits, $ matches the end of the string
				if (match) {
					advantageLevel = parseInt(match[0], 10); // Convert the matched string to a number
					console.log(`advantageLevel: ${advantageLevel} `); // 123
					// Night Vision grants 1 yard of sight range per level
					nightVisionDistance = game.settings.get("gurps-night-vision", "nightVisionDistance"); // distance per level of Night Vision
					nightVisionLevelMultiplier = advantageLevel*nightVisionDistance;
					//nightVisionLevelMultiplier = advantageLevel*3*parseInt(t.document.sight.range);

					console.log(`nightVisionLevelMultiplier: ${nightVisionLevelMultiplier};`);
				}
				multiplier.dim = Math.min(multiplier.dim, nightVisionLevelMultiplier);
				multiplier.bright = Math.min(multiplier.bright, nightVisionLevelMultiplier);
			} else {
				// token does not have Night Vision advantage, so multiplier 1
				console.log(`token: ${t.actor.name}; does not have Night Vision advantage, so no light multiplier`);
				multiplier.dim = 1;
				multiplier.bright = 1;
				nightVisionDistance = 1;
			}
			console.log(`multiplier.dim: ${multiplier.dim};`);
		}
	} else {
		// Player mode: sees best Night Vision of all owned tokens.
		multiplier = { dim: 1, bright: 1 };
		for (const t of relevantTokens) {
			let hasNightVisionAdvantage = GURPS.findAdDisad(t.actor,NightVisionAdvantageName) ? true : false;
			if (t.actor.flags.NightVisionSpell && t.actor.flags.NightVisionSpell > 0) {
				nightVisionDistance = game.settings.get("gurps-night-vision", "nightVisionDistance"); // distance per level of Night Vision
				advantageLevel = t.actor.flags.NightVisionSpell;
				nightVisionLevelMultiplier = advantageLevel*nightVisionDistance;
				console.log(`token: ${t.actor.name}; has Night Vision spell active; actor.flags.NightVisionSpell: ${t.actor.flags.NightVisionSpell}; spell Level: ${advantageLevel} ; nightVisionLevelMultiplier: ${nightVisionLevelMultiplier};`);
				multiplier.dim = Math.min(multiplier.dim, nightVisionLevelMultiplier);
				multiplier.bright = Math.min(multiplier.bright, nightVisionLevelMultiplier);
			} else if (hasNightVisionAdvantage === true) {
				let advantageObject = GURPS.findAdDisad(t.actor,NightVisionAdvantageName) ? GURPS.findAdDisad(t.actor,NightVisionAdvantageName) : {};
				let advantageName = advantageObject.name ? advantageObject.name: '';
				const match = advantageName.match(/\d+$/); // \d+ matches one or more digits, $ matches the end of the string
				if (match) {
					advantageLevel = parseInt(match[0], 10); // Convert the matched string to a number
					console.log(`advantageLevel: ${advantageLevel} `); // 123
					// Night Vision grants 1 yard of sight range per level
					nightVisionDistance = game.settings.get("gurps-night-vision", "nightVisionDistance"); // distance per level of Night Vision
					nightVisionLevelMultiplier = advantageLevel*nightVisionDistance;
					//nightVisionLevelMultiplier = advantageLevel*3*parseInt(t.document.sight.range);

					console.log(`nightVisionLevelMultiplier: ${nightVisionLevelMultiplier};`);
				}
				multiplier.dim = Math.max(multiplier.dim, nightVisionLevelMultiplier);
				multiplier.bright = Math.max(multiplier.bright, nightVisionLevelMultiplier);
			} else {
				// token does not have Night Vision advantage, so multiplier 1
				console.log(`token: ${t.actor.name}; does not have Night Vision advantage, so no light multiplier`);
				multiplier.dim = 1;
				multiplier.bright = 1;
				nightVisionDistance = 1;
			}
		}
	}

	// Define the units for nightvision distance
	/*

	let gridSize = game.scenes.current.grid.size; // find the pixel size of the grid
	let gridDistance = game.scenes.current.grid.distance; // find the size/distance of the grid; the number of feet or yards per grid unit
	let units = game.scenes.current.grid.units; // find the units of the grid; usually ft or yd
	let gridScale = Math.floor(gridSize / gridDistance); // estimate pixels per grid unit
	*/
	gridUnitPixels = game.scenes.viewed.dimensions.distancePixels; // find the pixels per grid unit (usually ft)
	//	distancePix = game.scenes.viewed.dimensions.distancePixels; // find the pixels per grid unit (usually ft)

	//console.log("LOOK HERE", multiplier, result);

	// Refresh lighting to (un)apply Night Vision parameters to them
	for (const { object } of canvas.effects.lightSources) {
		if (!((object instanceof AmbientLight) || (object instanceof Token))) continue;
		object.initializeLightSource();
	}

};

const Debouncer = foundry.utils.debounce(visionCalculator, 10);

Hooks.on("controlToken", () => {
	Debouncer();
});