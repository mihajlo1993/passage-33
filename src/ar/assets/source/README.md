# AR source drop folder

Place optional final offline sources in this folder. The exact accepted names are:

```text
sheet01.png
sheet01-mask.png
sheet02.png
sheet02-mask.png
targets.mind
monster-source.png
```

The final media pass prefers `assets-incoming/creature.png` for the room creature and normalizes it to the runtime size before the same exact-black key. `monster-source.png` remains the legacy/manual override used when no incoming creature exists.

Do not put generated output here. See `src/ar/TARGETS.md` for required dimensions, mask preparation, stable MindAR target order, and generator commands. With only this README present, deterministic placeholders are generated.
