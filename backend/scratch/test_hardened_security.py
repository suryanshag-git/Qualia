import asyncio
import httpx
from uuid import UUID

async def run_test():
    print("=== Running Hardened Security Integration Tests ===")
    
    # We will use the local FastAPI backend instance
    base_url = "http://localhost:8000/api/v1"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Signup Alice
        print("\n1. Signing up test_user_alice...")
        alice_signup = await client.post(
            f"{base_url}/auth/signup",
            json={"username": "test_user_alice"}
        )
        assert alice_signup.status_code == 200 or (
            alice_signup.status_code == 400 and "already registered" in alice_signup.json()["detail"]
        )
        
        # 2. Login Alice
        print("2. Logging in test_user_alice...")
        alice_login = await client.post(
            f"{base_url}/auth/login",
            json={"username": "test_user_alice"}
        )
        assert alice_login.status_code == 200
        alice_data = alice_login.json()
        alice_token = alice_data["token"]
        alice_id = alice_data["user_id"]
        print(f"   Alice Token: {alice_token}")
        
        # 3. Signup and Login Bob
        print("\n3. Signing up and logging in test_user_bob...")
        bob_signup = await client.post(
            f"{base_url}/auth/signup",
            json={"username": "test_user_bob"}
        )
        # Login if already signed up
        bob_login = await client.post(
            f"{base_url}/auth/login",
            json={"username": "test_user_bob"}
        )
        assert bob_login.status_code == 200
        bob_data = bob_login.json()
        bob_token = bob_data["token"]
        bob_id = bob_data["user_id"]
        print(f"   Bob Token: {bob_token}")
        
        # 4. Alice uploads an interview transcript
        print("\n4. Alice uploading interview transcript...")
        alice_payload = {
            "title": "Alice Secret Discovery Session",
            "transcript": "Hello researcher, this is a secret interview transcript with sensitive customer workflows.",
            "participant_info": {"name": "Alice Cooper", "role": "Singer", "company": "Rock LLC"}
        }
        upload_response = await client.post(
            f"{base_url}/interviews",
            headers={"Authorization": f"Bearer {alice_token}"},
            json=alice_payload
        )
        assert upload_response.status_code == 201
        interview_id = upload_response.json()["interview"]["id"]
        print(f"   Successfully uploaded interview {interview_id} owned by Alice.")
        
        # 5. Alice performs a semantic search
        print("\n5. Alice searching for her own transcript...")
        alice_search = await client.post(
            f"{base_url}/search",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={"query": "secret discovery session", "limit": 5, "threshold": 0.1}
        )
        if alice_search.status_code != 200:
            print(f"Error status: {alice_search.status_code}")
            print(f"Error body: {alice_search.text}")
        assert alice_search.status_code == 200
        alice_results = alice_search.json()
        print(f"   Alice found {len(alice_results)} results.")
        assert len(alice_results) >= 1
        assert alice_results[0]["interview"]["title"] == "Alice Secret Discovery Session"
        
        # 6. Bob performs the same search -> should return 0 results (User isolation check)
        print("\n6. Bob searching for Alice's transcript...")
        bob_search = await client.post(
            f"{base_url}/search",
            headers={"Authorization": f"Bearer {bob_token}"},
            json={"query": "secret discovery session", "limit": 5, "threshold": 0.1}
        )
        assert bob_search.status_code == 200
        bob_results = bob_search.json()
        print(f"   Bob found {len(bob_results)} results.")
        assert len(bob_results) == 0, "Security leak! Bob retrieved Alice's data."
        print("   [OK] User isolation search block verified!")

        # 7. Bob tries to delete Alice's interview -> should be blocked / 404
        print("\n7. Bob attempting to delete Alice's interview...")
        bob_delete = await client.delete(
            f"{base_url}/interviews/{interview_id}",
            headers={"Authorization": f"Bearer {bob_token}"}
        )
        print(f"   Bob delete response: {bob_delete.status_code}")
        assert bob_delete.status_code == 404
        print("   [OK] Unauthorized deletion block verified!")

        # 8. Alice deletes her own interview -> should succeed
        print("\n8. Alice deleting her own interview...")
        alice_delete = await client.delete(
            f"{base_url}/interviews/{interview_id}",
            headers={"Authorization": f"Bearer {alice_token}"}
        )
        assert alice_delete.status_code == 200
        print("   [OK] Alice deleted her own interview successfully.")

        # 9. Verify deletion completed
        alice_search_after = await client.post(
            f"{base_url}/search",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={"query": "secret discovery session", "limit": 5, "threshold": 0.1}
        )
        assert len(alice_search_after.json()) == 0
        print("   [OK] Interview verified as completely removed.")

        print("\n=== ALL HARDENED SECURITY AND PRIVACY INTEGRATION TESTS PASSED ===")

if __name__ == "__main__":
    asyncio.run(run_test())
