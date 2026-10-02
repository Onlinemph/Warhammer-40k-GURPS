  // called-shot locations and their penalties (B398-399)
  // Chinks in Armor (B400): an aimed attack at a gap in the armour, -8 on the torso and -10 anywhere else, halves the armour's DR.
  // Planned locations carry a "#c" suffix; only aiming attackers (elites by default) consider them.
  const CHINK = loc => loc === "torso" ? -8 : -10;
  const locName = l => l && l.endsWith("#c") ? "chink in the " + l.slice(0, -2) + " armour" : l;
  const AIM = { torso: 0, vitals: -3, skull: -7, eye: -9, face: -5, neck: -5, groin: -3, arm: -2, leg: -2, hand: -4, foot: -4 };
  // an aimed attack at one of these that misses by exactly 1 hits the torso instead (B552 note 1)
  const NEAR_TORSO = new Set(["eye", "skull", "face", "groin", "neck", "vitals"]);
  // cover (Tactical Shooting p. 28): what it takes off a foe's shot at you, and what it costs you to shoot back from
  // behind it unless braced and aiming; its DR for the legs and groin it hides (B407)
  const COVER_DR = { none: 0, crate: 15, barricade: 60, corner: 60, light: 15, heavy: 60, crest: 200, parapet: 50 };
  const COVER_PEN = { none: 0, crate: 2, corner: 2, light: 2, barricade: 3, heavy: 4, crest: 2, parapet: 3 };
  const COVER_OWN = { none: 0, crate: 0, corner: 0, light: 0, barricade: 2, heavy: 4, crest: 0, parapet: 0 };
  // what each kind of cover hides (B407): 1 covered, 0.5 half exposed (a random hit there strikes the cover on 4-6).
  // A crate or light cover is waist-high; a barricade chest-high; heavy cover a firing slit; a corner hides one side
  const LEGS = { leg: 1, foot: 1, groin: 1 };
  const HIDES = {
    crate: LEGS, light: LEGS, crest: LEGS, parapet: { ...LEGS, vitals: 0.5, torso: 0.5 },
    barricade: { ...LEGS, torso: 0.5, vitals: 0.5, arm: 0.5, hand: 0.5 },
    heavy: { ...LEGS, torso: 1, vitals: 1, arm: 0.5, hand: 0.5 },
    corner: { torso: 0.5, vitals: 0.5, groin: 0.5, arm: 0.5, hand: 0.5, leg: 0.5, foot: 0.5 },
  };
  // a crouching, kneeling or lying target is an extra -2 to hit in these (B548)
  const LOW = new Set(["torso", "vitals", "groin", "leg", "foot"]);
  // plunging fire: how high each location sits on a standing man (yards, of 2), and how high each kind of cover
  // stands. Cover a yard in front of a target hides a location only while the line from a higher shooter passes
  // below the cover's top there; it drops a yard every (distance / height advantage) yards
  const LOC_H = { foot: 0.1, leg: 0.5, groin: 0.9, hand: 1.0, vitals: 1.15, torso: 1.25, arm: 1.35, neck: 1.65, face: 1.75, eye: 1.75, skull: 1.85 };
  const COVER_TOP = { crate: 1, light: 1, barricade: 1.5, heavy: 1.9 };

