def stock_history_key(symbol: str):
    return f"stock_history:{symbol.upper()}:252"


def prediction_key(symbol: str):
    return f"prediction:{symbol.upper()}"


def portfolio_analysis_key(email: str, portfolio_id: str):
    return f"portfolio_analysis:{email}:{portfolio_id}"


def optimized_portfolio_key(email: str, portfolio_id: str):
    return f"optimized_portfolio:{email}:{portfolio_id}"


def sentiment_key(symbol: str):
    return f"sentiment:{symbol.upper()}"


def chart_inference_key(symbol: str):
    return f"chart_inference:{symbol.upper()}"