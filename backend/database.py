from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["risk-analyzer"]
users_collection = db["users"]
user_info_collection = db["user_info"]
notifications_collection = db["notifications"]
portfolios_collection = db["portfolios"]
holdings_collection = db["holdings"]
stock_price_history_collection=db["stock-price-history"]

# ensure unique email
users_collection.create_index("email", unique=True)
user_info_collection.create_index("email", unique=True)
portfolios_collection.create_index("email")
portfolios_collection.create_index(
    [("email", 1), ("name", 1)],
    unique=True,
)
holdings_collection.create_index([("portfolio_id", 1), ("email", 1)])
holdings_collection.create_index(
    [("portfolio_id", 1), ("symbol", 1)],
    unique=True,
)

stock_price_history_collection.create_index(
  [ ("symbol", 1), ("date", 1 )],
   unique=True ,
)
