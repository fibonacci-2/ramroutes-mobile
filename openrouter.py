import requests
import json

# First API call with reasoning
TAGS = [
    "academic", "arts", "career", "cultural", "health & fitness",
    "food", "mental-health", "social", "dance", "spiritual", "sports", "greek life", "volunteering"
]
def event_text(e: dict) -> str:
    return f"Name: {e.get('name', '')}\nDate: {e.get('date', '')}\nLocation: {e.get('buildingName', '')}\nDescription: {e.get('description', '')}"

SYSTEM_PROMPT = f"""You tag GW campus events with topic labels for a student events app.
Allowed tags (use ONLY these, spelled exactly as given):
{", ".join(TAGS)}

Rules:
- Pick 1 to 3 tags that best describe the event, based on its name and description.
- Prefer the most specific/salient tags over broad ones.
- Respond with JSON only, e.g. {{"tags": ["food", "social"]}}
"""
ev =  {
    "name": "Tango Practica",
    "date": "Saturday, July 18 at 2:30PM EDT",
    "description": "GW Argentine Tango is hosting Saturday Practicas! Set with a Class AND Practica— no charge for all. No experience or partners needed— just bring yourself and some dancing shoes and/or socks!\n\nLocation: Hand Chapel (Vern) | 2100 Foxhall Rd NW"
  }

SYSTEM_PROMPT += event_text(ev)

response = requests.post(
  url="https://openrouter.ai/api/v1/chat/completions",
  headers={
    "Authorization": "Bearer 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",
    "Content-Type": "application/json",
  },
  data=json.dumps({
    "model": "dots-studio/dots-3-note-preview:free",
    "messages": [
        {
          "role": "system",
          "content": SYSTEM_PROMPT,
        }
      ],
    "reasoning": {"enabled": False}
  })
)

# Extract the assistant message with reasoning_details
response = response.json()
response = response['choices'][0]['message']
print(response)
# Preserve the assistant message with reasoning_details
messages = [
  {"role": "user", "content": "How many r's are in the word 'strawberry'?"},
  {
    "role": "assistant",
    "content": response.get('content'),
    "reasoning_details": response.get('reasoning_details')  # Pass back unmodified
  },
  {"role": "user", "content": "Are you sure? Think carefully."}
]

# Second API call - model continues reasoning from where it left off
response2 = requests.post(
  url="https://openrouter.ai/api/v1/chat/completions",
  data=json.dumps({
    "model": "dots-studio/dots-3-note-preview:free",
    "messages": messages,  # Includes preserved reasoning_details
    "reasoning": {"enabled": True}
  })
)
