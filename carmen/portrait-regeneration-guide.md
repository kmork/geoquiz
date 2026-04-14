# Carmen Portrait Regeneration Guide

Use this guide when regenerating suspect portraits so the roster moves toward one coherent visual language instead of drifting into mixed cartoon styles.

## Style Anchor

Target the best parts of the earlier `Dr. Atlas` portrait:

- painterly pulp-noir illustration
- grounded facial proportions
- clean, readable silhouette
- strong accessory readability
- textured dossier background
- chest-up or mid-torso framing
- subtle dramatic lighting
- stylized, but not chibi, not manga, not glossy mobile-game fantasy art

## Global Prompt Core

Use this as the base for all suspects:

```text
Use case: stylized-concept
Asset type: suspect dossier portrait for the Carmen detective game
Primary request: illustrated portrait of a master thief, matching the Dr. Atlas portrait style already used in the project
Style/medium: painterly pulp-noir character illustration, retro detective dossier art, hand-painted texture, grounded anatomy
Composition/framing: vertical chest-up portrait, centered or slightly off-center, strong silhouette, face and signature accessory clearly readable
Lighting/mood: moody but readable, cinematic noir rim light, warm textured background, subtle depth
Color palette: muted, character-led palette with one or two strong accent colors tied to the suspect
Constraints: no decorative border baked into the image, no frame, no parchment edge, no UI elements, no text, no watermark
Avoid: anime style, manga style, chibi proportions, overly youthful same-face look, glossy mobile game fantasy look, exaggerated cute expression, plastic skin, duplicate facial structure across characters
```

## Character Rules

Keep these consistent across all regenerated portraits:

- Preserve canon hair, accessory, quirk, and origin vibe from `carmen/src/content/suspects.js`.
- Preserve the face anchors from `carmen/villains_with_face_profiles.json`.
- Make each suspect visibly distinct in:
  - face shape
  - eye shape
  - mouth/expression
  - posture
  - age impression
  - material/clothing silhouette
- Prefer worldly, theatrical, criminal-aristocrat energy over youthful idol energy.

## First-Wave Priorities

These are the best first suspects to regenerate in the new style:

1. `Carmen Sandiego`
2. `Viktor Voss`
3. `Natasha Petrova`
4. `El Zorro`
5. `The Shadow`
6. `Lady Crimson`
7. `Phantom Fox`
8. `Scarlet Cipher`
9. `Professor Paradox`
10. `Golden Seraph`

This batch covers the most visible archetypes and gives you a reliable style baseline for the rest of the cast.

## First-Wave Prompts

### Carmen Sandiego

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: Carmen Sandiego as the glamorous mastermind of an international thief network
Style/medium: painterly pulp-noir illustration matching the earlier Dr. Atlas portrait style, grounded proportions, detective-file character art
Subject: black-haired woman from Buenos Aires in a red trench coat, elegant and dangerous, iconic leading-lady criminal presence
Composition/framing: chest-up vertical portrait, hat and red coat clearly visible, poised posture, no baked frame
Lighting/mood: dramatic noir lighting with warm dossier backdrop
Color palette: deep red, black, warm neutral tones
Constraints: heart-shaped face with dramatic cheekbones, large confident almond eyes, sly glamorous smile, long neck, poised chin, classic leading-lady silhouette; preserve her authoritative intelligence
Avoid: anime style, cute expression, teenager look, generic femme fatale, decorative border, text, watermark
```

### Viktor Voss

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: Viktor Voss as a blond aristocratic chess-obsessed thief from Vienna
Style/medium: painterly pulp-noir illustration matching Dr. Atlas style, grounded face structure, retro Interpol file portrait
Subject: blond man with monocle, severe tailored clothing, smug strategic criminal
Composition/framing: vertical chest-up portrait with monocle and upper coat clearly readable
Lighting/mood: warm shadowed dossier lighting, disciplined and composed
Color palette: muted gold, black, ivory, dark navy
Constraints: long rectangular face, one squinting eye and one monocled eye, thin smug grin, high forehead, rigid jaw, chess-master severity
Avoid: anime pretty-boy look, heroic captain vibe, soft rounded face, decorative border, text, watermark
```

### Natasha Petrova

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: Natasha Petrova as a sharp red-haired winter thief from Saint Petersburg
Style/medium: painterly pulp-noir illustration matching Dr. Atlas style
Subject: red-haired woman in fur hat and winter coat, confident and agile, glamorous but dangerous
Composition/framing: chest-up vertical portrait with fur hat and winter textures clearly visible
Lighting/mood: cold noir edge light against warm dossier background
Color palette: deep red, cream fur, icy blue accents
Constraints: round winter-apple face, intense catlike eyes, playful crooked grin, rosy cheeks, compact head, lively expression
Avoid: pin-up exaggeration, anime face, same-face glamour heroine look, decorative border, text, watermark
```

### El Zorro

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: El Zorro as a theatrical masked duelist thief from Seville
Style/medium: painterly pulp-noir illustration matching Dr. Atlas style
Subject: black-haired masked man, dramatic cape, duelist confidence, elegant rogue energy
Composition/framing: chest-up vertical portrait, mask and dramatic collar clearly readable, sharp silhouette
Lighting/mood: noir spotlight feel, charismatic and dangerous
Color palette: black, crimson accents, dark neutrals
Constraints: narrow triangular face, mischievous narrow eyes, cocky one-sided smirk, pointed chin, dramatic masked silhouette
Avoid: cartoon swashbuckler, exaggerated grin, anime swordsman look, decorative border, text, watermark
```

### The Shadow

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: The Shadow as a nearly unreadable phantom thief whose face is never fully seen
Style/medium: painterly pulp-noir illustration matching Dr. Atlas style, mystery emphasized over facial clarity
Subject: human figure wrapped in dark cloak, face mostly concealed, only eyes readable
Composition/framing: chest-up vertical portrait, silhouette-driven, no visible border, strong negative shape
Lighting/mood: heavy noir shadow, eerie but grounded, distant menace
Color palette: black, charcoal, muted brown, glowing eye highlights
Constraints: face mostly hidden, glowing slit eyes, mouth covered, no readable face, mysterious wrapped-head silhouette
Avoid: superhero look, anime ninja look, comic-book exaggeration, decorative border, text, watermark
```

### Lady Crimson

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: Lady Crimson as an opera-diva jewel thief from Monte Carlo
Style/medium: painterly pulp-noir illustration matching Dr. Atlas style
Subject: auburn-haired glamorous woman with ruby necklace, wealthy theatrical criminal presence
Composition/framing: chest-up vertical portrait with ruby necklace prominent
Lighting/mood: moonlit noir glamour, lush and aristocratic
Color palette: auburn, ruby red, ivory, dark wine tones
Constraints: full glamorous oval face, heavy-lidded diva eyes, big theatrical smile, lush cheeks, opera-star drama, beauty-mark energy
Avoid: generic fantasy queen look, anime idol look, cute softness, decorative border, text, watermark
```

### Phantom Fox

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: Phantom Fox as a silver-haired origami thief from Kyoto
Style/medium: painterly pulp-noir illustration matching Dr. Atlas style
Subject: silver-haired woman with fox brooch, elegant and intelligent, quick and precise
Composition/framing: chest-up vertical portrait with fox brooch and angular silhouette visible
Lighting/mood: quiet, sharp, watchful noir atmosphere
Color palette: silver, charcoal, muted cream, subtle fox-warm accent
Constraints: foxlike angular face, quick sly eyes, clever tight grin, sharp cheekbones, alert expression
Avoid: anime fox-girl look, fantasy cosplay, childlike face, decorative border, text, watermark
```

### Scarlet Cipher

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: Scarlet Cipher as a brilliant red-haired cryptography thief from Berlin
Style/medium: painterly pulp-noir illustration matching Dr. Atlas style
Subject: red-haired woman with coded tattoo detail, razor-sharp intelligence, predatory confidence
Composition/framing: chest-up vertical portrait, tattoo or coded detail readable without dominating
Lighting/mood: tense urban noir, analytical and dangerous
Color palette: red, black, steel gray, muted amber highlights
Constraints: sharp angular face, narrow hyper-alert hacker eyes, smug brilliant smirk, one eyebrow raised, predatory confidence
Avoid: cyberpunk neon overload, anime hacker girl, glossy fashion portrait, decorative border, text, watermark
```

### Professor Paradox

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: Professor Paradox as an eccentric white-haired time-obsessed criminal scholar from Geneva
Style/medium: painterly pulp-noir illustration matching Dr. Atlas style
Subject: white-haired older intellectual with pocket watch, absent-minded but dangerous genius
Composition/framing: chest-up vertical portrait with pocket watch visible, eccentric silhouette
Lighting/mood: strange, cerebral, slightly unstable noir mood
Color palette: off-white hair, brown coat, brass metal, deep burgundy accent
Constraints: huge forehead with narrow chin, mismatched distracted eyes, muttering absent-minded mouth, wild eyebrows, eccentric genius proportions
Avoid: goofy cartoon inventor, anime professor look, cute nerd energy, decorative border, text, watermark
```

### Golden Seraph

```text
Use case: stylized-concept
Asset type: suspect dossier portrait
Primary request: Golden Seraph as a blond antiquities thief with museum-statue elegance from Athens
Style/medium: painterly pulp-noir illustration matching Dr. Atlas style, grounded not fantasy
Subject: blond suspect with pendant and classical refinement, serene but superior criminal presence
Composition/framing: chest-up vertical portrait with pendant and regal posture clearly visible
Lighting/mood: museum glow, sacred-object elegance, cold confidence
Color palette: gold, cream, warm stone, muted laurel green or bronze accents
Constraints: classical statue face, calm idealized eyes, serene superior smile, symmetrical features, heroic profile, museum-marble elegance
Avoid: angelic fantasy armor heroine, anime beauty look, saintly innocence, decorative border, text, watermark
```

## Recommended Workflow

1. Regenerate the first-wave suspects using the prompts above.
2. Keep the output borderless and let the app UI provide the framing.
3. Drop each new portrait into `carmen/img/` using the same filename.
4. Review in:
   - Interpol profile
   - suspect lineup cards
   - final accusation target card
5. Only then tune `carmen/src/content/portrait-specs.js` if a specific portrait still needs slight positional adjustment.

## Review Checklist

- Does the character still match canon?
- Does the portrait read clearly at small size?
- Is the accessory immediately identifiable?
- Does the face look distinct from the rest of the cast?
- Does it feel closer to Dr. Atlas than to anime/cartoon mobile-game art?
- Is there any baked border, parchment edge, or decorative frame in the exported image?
