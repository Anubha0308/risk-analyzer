import os
import json
import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")

redis_client = redis.from_url(
    REDIS_URL,
    decode_responses=True
) if REDIS_URL else None


def get_cache(key: str):
    if not redis_client:
        return None

    try:
        data = redis_client.get(key)
        return json.loads(data) if data else None
    except Exception as e:
        print("Redis get error:", e)
        return None


def set_cache(key: str, value, ttl: int = 3600):
    if not redis_client:
        return

    try:
        redis_client.set(
            key,
            json.dumps(value, default=str),
            ex=ttl
        )
    except Exception as e:
        print("Redis set error:", e)


def delete_cache(key: str):
    if not redis_client:
        return

    try:
        redis_client.delete(key)
    except Exception as e:
        print("Redis delete error:", e)