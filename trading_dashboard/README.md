# Trading Dashboard

A local, self-contained trading dashboard application that displays real-time and historical market data using TradingView's Lightweight Charts library.

## Features

- **Multi-pane Grid Layout**: Dynamically configure 1, 2, 4, 6, or 8 chart panes
- **Multiple Data Providers**: 
  - Yahoo Finance (yfinance) for Indian equities and global stocks
  - Hyperliquid WebSocket for crypto perpetuals
- **Real-time Updates**: Live price streaming via Flask-SocketIO
- **Visual Feedback**: Price flash indicators (green/red) on ticker updates
- **Persistent Settings**: Grid layout saved in localStorage
- **Responsive Design**: CSS Grid-based layout with mobile support

## Project Structure

```
trading_dashboard/
├── app.py                 # Flask backend with SocketIO
├── data_source.py         # Data provider abstraction layer
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Main HTML template
└── static/
    ├── css/
    │   └── styles.css    # Dashboard styles
    └── js/
        └── app.js        # Frontend application logic
```

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Open your browser and navigate to:
```
http://localhost:5000
```

## Usage

### Grid Layout
- Use the dropdown in the header to select 1, 2, 4, 6, or 8 panes
- Selection is automatically saved and restored on page reload

### Chart Controls (per pane)
1. **Provider**: Select data source (Yahoo Finance or Hyperliquid)
2. **Symbol**: Enter stock/crypto symbol (e.g., AAPL, BTC, RELIANCE.NS)
3. **Timeframe**: Choose candle interval (1m to 1w)
4. **Load**: Fetch historical data and start live updates

### Keyboard Shortcuts
- Press `Enter` in the symbol input field to load data

## Technical Details

### Backend Architecture
- **Flask**: Web framework serving static files and REST API
- **Flask-SocketIO**: Real-time bidirectional communication
- **Data Provider Pattern**: Abstract base class enables easy addition of new brokers

### Frontend Implementation
- **Vanilla JavaScript (ES2020)**: No build tools required
- **Lightweight Charts**: Standalone production build loaded from CDN
- **ResizeObserver**: Automatic chart resizing with container changes
- **Performance Optimization**: Uses `series.update()` for real-time ticks (not `setData()`)

### Adding New Data Providers

To add a new broker (e.g., Alpaca, Binance):

1. Create a new class in `data_source.py`:
```python
class AlpacaProvider(DataProvider):
    def get_historical_data(self, symbol: str, interval: str) -> List[Dict[str, Any]]:
        # Implementation
        pass
    
    def subscribe_to_live_updates(self, symbol: str, callback: Callable) -> bool:
        # Implementation
        pass
    
    def unsubscribe_from_live_updates(self, symbol: str) -> bool:
        # Implementation
        pass
```

2. Register in the factory:
```python
PROVIDER_REGISTRY['alpaca'] = AlpacaProvider
```

## License & Attribution

This application uses TradingView's Lightweight Charts library.

**Data by [TradingView](https://www.tradingview.com)**

Lightweight Charts is licensed under the Apache 2.0 License.

## Requirements

- Python 3.8+
- Modern web browser with ES2020 support

## Dependencies

- flask==3.0.0
- flask-socketio==5.3.6
- yfinance==0.2.31
- websocket-client==1.6.4
- eventlet==0.34.2
