# Bharat Atlas Guess

A free, Wordle-style India geography website focused on states/UTs and districts.

## What this project includes

- Daily puzzle mode for State/UT guesses
- Daily puzzle mode for District guesses
- 6-guess gameplay with directional and comparative hints
- Interactive Leaflet map with guess markers and target reveal marker
- Rich facts panel revealed after solving or running out of guesses
- Searchable "Knowledge Atlas" section for learning geography details
- Fully static site: no backend, no paid hosting needed

## Game hints

- Distance and compass direction to the target
- Region match
- Area hint (`higher`, `lower`, `equal`)
- Population hint (`higher`, `lower`, `equal`)
- Coastal match (state mode)
- Parent state match (district mode)

## Run locally

Because this uses JavaScript modules, run it with a local server:

```bash
cd /workspaces/Games-
python3 -m http.server 8080
```

Open:

`http://localhost:8080`

## Deploy free on GitHub Pages

1. Push this repository to GitHub.
2. In repository settings, open `Pages`.
3. Under `Build and deployment`, select:
	- Source: `Deploy from a branch`
	- Branch: `main`
	- Folder: `/ (root)`
4. Save.
5. Your website will be available at:

`https://<your-username>.github.io/<repo-name>/`

## Files

- `index.html` - app structure
- `styles.css` - visual design and responsive layout
- `js/data.js` - states and districts dataset
- `js/app.js` - game logic and rendering

## Notes

- The dataset is curated for immediate use and can be expanded with more district entries.
- District coverage has been expanded significantly across states and union territories.
- Numeric figures are intended for educational gameplay and may be updated over time.