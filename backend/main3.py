import os
from google import genai

# Set your API key from Google AI Studio
os.environ["GEMINI_API_KEY"] = "your_google_api_key_here"

client = genai.Client()

print("Sending request to Gemma 4...")

response = client.models.generate_content(
    model="gemma-4-31b-it", # The specific 31B instruct model
    contents="Write a quick Python script to sort a list of dictionaries."
)

print(response.text)