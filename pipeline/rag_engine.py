"""
RAG Engine — ChromaDB-based retrieval for improved category classification.

Indexes extracted transactions into a vector store. During extraction,
retrieves similar past transactions to provide few-shot examples for
better category assignment.

Uses sentence-transformers for embeddings (all-MiniLM-L6-v2, runs locally).
"""

import os
import json
from config_loader import get_config

_chroma_available = False
try:
    import chromadb
    from chromadb.config import Settings
    _chroma_available = True
except ImportError:
    pass


class RAGEngine:
    """
    Financial transaction RAG using ChromaDB.

    Usage:
        rag = RAGEngine()
        rag.index_transactions(transactions, source_file="hsbc_nov_2025.json")
        similar = rag.find_similar("KEELLS SUPER NUGEGODA", n_results=3)
    """

    def __init__(self):
        if not _chroma_available:
            raise ImportError("chromadb is not installed. Install with: pip install chromadb")

        config = get_config()
        rag_config = config.get("rag", {})
        self.enabled = rag_config.get("enabled", True)
        db_path = rag_config.get("db_path", "./data/chromadb")
        collection_name = rag_config.get("collection_name", "lidlens_transactions")

        os.makedirs(db_path, exist_ok=True)

        self._client = chromadb.PersistentClient(
            path=db_path,
            settings=Settings(anonymized_telemetry=False),
        )
        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def index_transactions(self, transactions: list[dict], source_file: str = ""):
        """Index a list of transactions into the vector store."""
        if not self.enabled or not transactions:
            return

        documents = []
        metadatas = []
        ids = []

        for i, tx in enumerate(transactions):
            desc = tx.get("description", "")
            category = tx.get("category", "other")
            amount = tx.get("amount", 0)
            currency = tx.get("currency", "LKR")
            direction = tx.get("direction", "debit")

            if not desc:
                continue

            doc_text = f"{desc} | {category} | {currency} {amount} | {direction}"
            doc_id = f"{source_file}_{i}" if source_file else f"tx_{i}_{hash(desc)}"

            documents.append(doc_text)
            metadatas.append({
                "description": desc,
                "category": category,
                "amount": float(amount) if amount else 0,
                "currency": currency,
                "direction": direction,
                "source": source_file,
            })
            ids.append(doc_id)

        if documents:
            # Upsert to handle re-indexing
            self._collection.upsert(
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )
            print(f"    📚 Indexed {len(documents)} transactions into RAG")

    def find_similar(self, description: str, n_results: int = 5) -> list[dict]:
        """Find similar past transactions for category context."""
        if not self.enabled:
            return []

        try:
            results = self._collection.query(
                query_texts=[description],
                n_results=n_results,
            )

            similar = []
            if results and results["metadatas"]:
                for meta in results["metadatas"][0]:
                    similar.append({
                        "description": meta.get("description", ""),
                        "category": meta.get("category", "other"),
                        "amount": meta.get("amount", 0),
                        "currency": meta.get("currency", "LKR"),
                    })
            return similar
        except Exception as e:
            print(f"    ⚠️  RAG query error: {e}")
            return []

    def get_category_context(self, description: str) -> str:
        """Generate few-shot context string for category classification."""
        similar = self.find_similar(description, n_results=3)
        if not similar:
            return ""

        lines = ["Similar past transactions for context:"]
        for tx in similar:
            lines.append(f"  - \"{tx['description']}\" → {tx['category']}")
        return "\n".join(lines)

    @property
    def count(self) -> int:
        """Number of indexed transactions."""
        try:
            return self._collection.count()
        except Exception:
            return 0


def run():
    """Index all existing structured JSON files into RAG."""
    config = get_config()
    structured_dir = config["pipeline"]["structured_dir"]

    if not os.path.isdir(structured_dir):
        print(f"⚠️  No structured data directory: {structured_dir}")
        return

    rag = RAGEngine()
    total = 0

    for file in sorted(os.listdir(structured_dir)):
        if not file.endswith(".json"):
            continue
        filepath = os.path.join(structured_dir, file)
        with open(filepath, "r") as f:
            try:
                transactions = json.load(f)
                rag.index_transactions(transactions, source_file=file)
                total += len(transactions)
            except json.JSONDecodeError:
                print(f"  ⚠️  Invalid JSON: {file}")

    print(f"\n📊 RAG index: {rag.count} transactions total")


if __name__ == "__main__":
    run()
