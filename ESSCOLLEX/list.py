import os

# Configuration
target_folder = 'ESSCOLLEX'
extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mp4')

def generate_js_array(folder_path):
    # Check if directory exists to avoid errors
    if not os.path.exists(folder_path):
        print(f"Error: Folder '{folder_path}' not found.")
        return

    # Get files and filter by extensions
    files = [
        f"{folder_path}/{f}" 
        for f in os.listdir(folder_path) 
        if f.lower().endswith(extensions)
    ]

    # Format the output for JavaScript
    print("const links = [")
    for i, file_path in enumerate(files):
        comma = "," if i < len(files) - 1 else ""
        print(f"  '{file_path}'{comma}")
    print("];")

if __name__ == "__main__":
    generate_js_array(target_folder)