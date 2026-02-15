from datetime import datetime, timezone, timedelta

login_attempts = {}

MAX_ATTEMPTS = 5
LOCK_TIME_MINUTES = 5


def check_locked(email: str):
    data = login_attempts.get(email)

    if not data:
        return False, 0

    locked_until = data.get("locked_until")

    if locked_until and datetime.now(timezone.utc)  < locked_until:
        remaining = int((locked_until - datetime.now(timezone.utc)).total_seconds())
        return True, remaining

    return False, 0

def record_failure(email: str):
    data = login_attempts.setdefault(email, {"fails": 0, "locked_until": None})

    data["fails"] += 1

    if data["fails"] >= MAX_ATTEMPTS:
        data["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCK_TIME_MINUTES)
        data["fails"] = 0   # reset counter after locking
        
        
def reset_attempts(email: str):
    if email in login_attempts:
        del login_attempts[email]


