from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["risk-analyzer"]
users_collection = db["users"]
user_info_collection = db["user_info"]
user_stocks_info_collection = db["user_stocks_info"]#user specific stock info as to what does a user saw the last time 

# ensure unique email
users_collection.create_index("email", unique=True)
user_info_collection.create_index("email", unique=True)
user_stocks_info_collection.create_index("email", unique=True) #inside it stock should be unique as well 
# ensure unique stock per user 
#during login store user email in user_stocks_info_collection

