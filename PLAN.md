# TODO:

## setup notfications

## automate scrapping
* implement model from openrouter
* one sequence once per night, scrape, compute tags, upload
* test on gu data


## chatbot
* exp: pass all weekely events to a large context window llm + query and see performanfce
* query emb*event emb event filteration first to reduce k in prompt


## events
* rsvp to event
* show how many rsvps
* more visibility for pop events


## personalization v2 (embeddings)
score = tagOverlap + λ·cosine(profile_emb, event_emb), λ = 0.5
* event embedded once at scrape/upload time (scraper/embedder.js, qwen3-embedding-8b via openrouter), stored on the doc - never re-embedded
* user profile (major + bio + interests) embedded nightly in recommend.js, compared against the stored event embeddings
* eligible = has interests OR bio OR major (not interests-only) - a student with no tags picked but a bio/major still gets embedded + matched
* server-only (OpenRouter key never ships to the app) - recommend.js writes user.recommendedEvents; the app's rankByTagOverlap stays the tag-only client fallback for when that list is empty/stale
* TODO: cache profile_emb + a hash of its input text on users/{uid}, only re-embed on hash mismatch - right now every eligible user is re-embedded every run, which is fine at current scale but wasteful/non-resilient (one bad OpenRouter night drops embeddings for everyone that run) once it grows

## gps
* hotspots
* notific: if an event is now happening closely (in the building), notify passing by user
  but like, isn't entire campus close by?