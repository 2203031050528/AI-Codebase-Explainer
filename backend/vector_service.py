import chromadb

client = chromadb.Client()
collection = client.create_collection("codebase")


def store_code(file_path, code):
    chunks = [code[i:i+500] for i in range(0, len(code), 500)]

    for i, chunk in enumerate(chunks):
        collection.add(
            documents=[chunk],
            metadatas=[{"file": file_path}],
            ids=[f"{file_path}_{i}"]
        )


def search_code(query):
    results = collection.query(
        query_texts=[query],
        n_results=3
    )

    return results["documents"]