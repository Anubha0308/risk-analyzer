from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["risk-analyzer"]
users_collection = db["users"]
user_info_collection = db["user_info"]

# ensure unique email
users_collection.create_index("email", unique=True)
user_info_collection.create_index("email", unique=True)
