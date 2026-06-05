import os
import base64
import requests
import io
from PIL import Image

def run_pipeline(user_image_base64, product_image_url):
    """
    Virtual Try-On Pipeline
    Uses Replicate API if REPLICATE_API_TOKEN is set.
    Otherwise, returns a mocked blended image (for local demo purposes).
    """
    token = os.getenv("REPLICATE_API_TOKEN")
    
    if token and token != "your_replicate_token_here":
        try:
            # Replicate implementation (viktorfa/idm-vton or similar)
            import replicate
            # For demonstration, assuming we send URLs or base64. 
            # Replicate usually prefers file objects or URLs.
            # If user_image_base64 starts with data:image, strip it.
            if user_image_base64.startswith("data:image"):
                user_image_base64 = user_image_base64.split(",")[1]
            
            # Since this is a hackathon/demo, we use replicate client.
            # The actual Replicate model expects URLs usually. We might need to upload base64 to a temporary store,
            # or use the data URI. Replicate python client supports data URIs.
            user_data_uri = f"data:image/jpeg;base64,{user_image_base64}"
            
            output = replicate.run(
                "viktorfa/idm-vton:81d15532ed3b9347970d4abda2ebc96f2a632df665d95e0c81216d1ba5d02da1",
                input={
                    "garm_img": product_image_url,
                    "human_img": user_data_uri,
                    "garment_des": "A piece of clothing"
                }
            )
            
            # output is a URL
            if output:
                res = requests.get(output)
                return base64.b64encode(res.content).decode('utf-8')
        except Exception as e:
            print(f"Replicate API Error: {e}")
            # fallback to mock
            pass

    # --- MOCK FALLBACK (OpenCV/Pillow basic blend) ---
    print("Using local mock fallback for Try-On")
    return create_mock_tryon(user_image_base64, product_image_url)

def create_mock_tryon(user_b64, prod_url):
    try:
        # Strip data URI header if present
        if user_b64.startswith("data:image"):
            user_b64 = user_b64.split(",")[1]
            
        user_bytes = base64.b64decode(user_b64)
        user_img = Image.open(io.BytesIO(user_bytes)).convert("RGBA")
        
        # Download product image
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        res = requests.get(prod_url, headers=headers)
        if res.status_code != 200:
            print(f"Failed to download product image, status: {res.status_code}")
            raise Exception("Download failed")
            
        prod_img = Image.open(io.BytesIO(res.content)).convert("RGBA")
        
        # Resize product to fit roughly in the center
        target_width = int(user_img.width * 0.6)
        aspect = prod_img.height / prod_img.width
        target_height = int(target_width * aspect)
        prod_img = prod_img.resize((target_width, target_height))
        
        # Make product image slightly transparent for "blend" effect
        # In a real local CV pipeline, we'd use MediaPipe to find torso and warp the image.
        prod_data = prod_img.getdata()
        new_data = []
        for item in prod_data:
            # Change all white (also shades of white)
            # to transparent, otherwise reduce alpha
            if item[0] > 220 and item[1] > 220 and item[2] > 220:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append((item[0], item[1], item[2], int(item[3] * 0.85)))
        prod_img.putdata(new_data)
        
        # Paste onto user image
        paste_x = int((user_img.width - target_width) / 2)
        paste_y = int((user_img.height - target_height) / 2) + int(user_img.height * 0.1) # move down slightly
        
        user_img.paste(prod_img, (paste_x, paste_y), prod_img)
        
        # Convert back to base64
        buffered = io.BytesIO()
        user_img.convert("RGB").save(buffered, format="JPEG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"Mock tryon error: {e}")
        # Just return original if it fails
        return user_b64
