# Diagnostic Plan: Picture Game Issues

## Problem 1: Images Not Loading
- JSON has paths like: `img/heritage/great-wall-of-china.jpg`
- Images exist in filesystem
- Game sets: `ui.heritageImage.src = site.imageUrl;`
- **Hypothesis**: Path resolution issue - needs to be relative to HTML file

## Problem 2: Autocomplete Not Working  
- HTML has: `<input list="country-suggestions">`
- HTML has: `<datalist id="country-suggestions">`
- **Need to check**: Is populateAutocomplete() being called?

## Actions:
1. Check if picture-guess-main.js calls populateAutocomplete()
2. Test if images load with direct browser navigation
3. Add console logging to debug
4. Fix path issues
