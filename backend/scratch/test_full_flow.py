import sys
import os
import json

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app

def test_full_processing_flow():
    print("=== Qualia End-to-End Processing Flow Integration Test ===")
    
    # Initialize TestClient
    client = TestClient(app)

    # Prepare sample interview payload
    sample_payload = {
        "title": "B2B SaaS PM Interview on Synthesis Pain Points",
        "transcript": (
            "Interviewer: Hi Mark, what is the biggest pain point in user discovery?\n"
            "Mark: Copy-pasting insights into Notion documents is extremely manual. "
            "I spend hours re-watching recordings to get quotes. We need automated tag coding."
        ),
        "participant_info": {
            "name": "Mark Jones",
            "role": "Senior Product Manager",
            "company": "SaaSFlow Corp"
        },
        "metadata": {
            "source": "Zoom video integration test"
        }
    }

    print("\nSending POST request to `/api/v1/interviews`...")
    try:
        response = client.post("/api/v1/interviews", json=sample_payload)
        
        print(f"Response Status Code: {response.status_code}")
        
        # Verify 201 Created status
        assert response.status_code == 201, f"Expected status 201, got {response.status_code}"
        
        data = response.json()
        
        # Validate return structures
        assert "interview" in data, "Response missing 'interview' field"
        assert "insight" in data, "Response missing 'insight' field"
        
        interview = data["interview"]
        insight = data["insight"]
        
        # Verify interview mappings
        print("\nSUCCESS: Interview successfully created and saved:")
        print(f" - Interview ID: {interview['id']}")
        print(f" - Title: {interview['title']}")
        print(f" - Date: {interview['date']}")
        
        # Verify insight mappings
        print("\nSUCCESS: Insights extracted and linked:")
        print(f" - Insight ID: {insight['id']}")
        print(f" - Linked Interview ID: {insight['interview_id']}")
        print(f" - Extracted Persona: {insight['data']['user_persona']}")
        print(f" - Extracted Sentiment: {insight['data']['sentiment']}")
        print(f" - Key Themes: {insight['data']['themes']}")
        
        print("\nFull Result Payload:")
        print(json.dumps(data, indent=2))
        
        print("\n=== INTEGRATION TEST PASSED SUCCESSFULLY ===")
        
    except AssertionError as ae:
        print(f"\nAssertion error: {ae}")
        sys.exit(1)
    except Exception as e:
        print(f"\nIntegration test encountered an unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_full_processing_flow()
