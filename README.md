# RiskAI

RiskAI is a web application that leverages advanced machine learning algorithms to analyze stock market data and provide real-time risk assessments. Our platform helps investors identify potential downside risks before they materialize, enabling better portfolio protection and informed decision-making.

## Features

*   **Risk Probability**: Get precise risk scores (0-100%) calculated using advanced ML models that analyze market volatility, price trends, and historical patterns.
*   **Detailed Reasons**: Understand the "why" behind each risk assessment with AI-generated explanations covering market conditions, technical indicators, and trend analysis.
*   **Price & Volatility Charts**: Visualize stock performance and volatility with interactive charts.

## Technologies Used

### Frontend

*   React
*   Vite
*   Tailwind CSS

### Backend

*   Python
*   FastAPI
*   scikit-learn

## Getting Started

### Prerequisites

*   Node.js and npm
*   Python 3 and pip

### Installation and Usage

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-folder>
    ```

2.  **Backend Setup:**
    ```bash
    cd backend
    <enter the virtual environment>
    pip install -r requirements.txt
    uvicorn main:app --reload
    (test your backend using FastAPI/SwaggerUI on the port you have entered for running the backend)
    ```

3.  **Frontend Setup:**
    ```bash
    cd ../animation-main
    npm install
    npm run dev
    ```

## Project Structure

```
.
├── animation-main/         # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── graphs/         # Graph components
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
├── backend/                # Backend Flask application
│   ├── auth/
│   ├── model/
│   ├── routes/
│   ├── utils/
│   ├── main.py             # Flask app entry point
│   └── requirements.txt
└── README.md
```
