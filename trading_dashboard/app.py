"""
Flask Backend for Trading Dashboard
Serves frontend and handles data streaming via SocketIO
"""

import json
import threading
import time
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
from websocket import create_connection, WebSocketTimeoutException
from data_source import get_provider, YFinanceProvider, HyperliquidProvider

app = Flask(__name__)
app.config['SECRET_KEY'] = 'trading-dashboard-secret'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Initialize providers
yfinance_provider = get_provider('yfinance')
hyperliquid_provider = get_provider('hyperliquid', socketio=socketio)

# Track active subscriptions per pane
pane_subscriptions = {}  # {pane_id: {'symbol': str, 'provider': str, 'interval': str}}

# Hyperliquid WebSocket connection management
hl_ws_connections = {}  # {symbol: ws_connection}


def hyperliquid_ws_worker(symbol: str):
    """Background worker to maintain Hyperliquid WebSocket connection"""
    try:
        ws_url = "wss://api.hyperliquid.xyz/info"
        ws = create_connection(ws_url, timeout=10)
        
        # Subscribe to the coin's order book / trades
        subscribe_msg = {
            "method": "sub",
            "subscription": {
                "type": "allMids"
            }
        }
        ws.send(json.dumps(subscribe_msg))
        
        while symbol in hl_ws_connections:
            try:
                msg = ws.recv()
                data = json.loads(msg)
                
                if 'channel' in data and data['channel'] == 'allMids':
                    mids = data.get('data', {})
                    if symbol in mids:
                        price = float(mids[symbol])
                        timestamp = int(time.time())
                        
                        # Create candle update
                        candle_data = {
                            'time': timestamp,
                            'open': price,
                            'high': price,
                            'low': price,
                            'close': price
                        }
                        
                        hyperliquid_provider.handle_price_update(symbol, candle_data)
            except WebSocketTimeoutException:
                # Send ping to keep connection alive
                ws.send(json.dumps({"method": "ping"}))
            except Exception as e:
                print(f"Hyperliquid WS error for {symbol}: {e}")
                break
        
        ws.close()
    except Exception as e:
        print(f"Failed to connect Hyperliquid WS for {symbol}: {e}")
    
    if symbol in hl_ws_connections:
        del hl_ws_connections[symbol]


@app.route('/')
def index():
    """Serve the main dashboard"""
    return render_template('index.html')


@app.route('/api/historical')
def get_historical():
    """REST endpoint to fetch historical data"""
    symbol = request.args.get('symbol', 'AAPL')
    interval = request.args.get('interval', '1d')
    provider = request.args.get('provider', 'yfinance')
    
    if provider == 'yfinance':
        data = yfinance_provider.get_historical_data(symbol, interval)
    elif provider == 'hyperliquid':
        data = hyperliquid_provider.get_historical_data(symbol, interval)
    else:
        return jsonify({'error': 'Unknown provider'}), 400
    
    return jsonify({'symbol': symbol, 'interval': interval, 'data': data})


@socketio.on('subscribe')
def handle_subscribe(data):
    """Handle subscription request from frontend"""
    pane_id = data.get('pane_id')
    symbol = data.get('symbol')
    provider_name = data.get('provider', 'yfinance')
    interval = data.get('interval', '1d')
    
    pane_subscriptions[pane_id] = {
        'symbol': symbol,
        'provider': provider_name,
        'interval': interval
    }
    
    if provider_name == 'hyperliquid':
        # Start WebSocket worker if not already running
        if symbol not in hl_ws_connections:
            hl_ws_connections[symbol] = True
            thread = threading.Thread(target=hyperliquid_ws_worker, args=(symbol,), daemon=True)
            thread.start()
    
    emit('subscribed', {'pane_id': pane_id, 'symbol': symbol})


@socketio.on('unsubscribe')
def handle_unsubscribe(data):
    """Handle unsubscription from frontend"""
    pane_id = data.get('pane_id')
    
    if pane_id in pane_subscriptions:
        del pane_subscriptions[pane_id]


@socketio.on('connect')
def handle_connect():
    """Client connected"""
    print('Client connected')
    emit('connected', {'status': 'connected'})


@socketio.on('disconnect')
def handle_disconnect():
    """Client disconnected"""
    print('Client disconnected')
    # Clean up subscriptions for this client
    global pane_subscriptions
    pane_subscriptions = {}


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
