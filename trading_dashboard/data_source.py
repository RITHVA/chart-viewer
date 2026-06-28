"""
Data Provider Abstraction Layer
Supports plug-and-play data sources (Hyperliquid, YFinance, etc.)
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Callable, Optional
import yfinance as yf
from datetime import datetime, timedelta


class DataProvider(ABC):
    """Base class for all data providers"""
    
    @abstractmethod
    def get_historical_data(self, symbol: str, interval: str) -> List[Dict[str, Any]]:
        """Fetch historical candlestick data"""
        pass
    
    @abstractmethod
    def subscribe_to_live_updates(self, symbol: str, callback: Callable[[Dict[str, Any]], None]) -> bool:
        """Subscribe to real-time price updates"""
        pass
    
    @abstractmethod
    def unsubscribe_from_live_updates(self, symbol: str) -> bool:
        """Unsubscribe from real-time updates"""
        pass


class YFinanceProvider(DataProvider):
    """Yahoo Finance provider for Indian equities and global stocks"""
    
    def __init__(self):
        self._subscriptions: Dict[str, Callable] = {}
    
    def get_historical_data(self, symbol: str, interval: str) -> List[Dict[str, Any]]:
        """
        Fetch historical data from Yahoo Finance
        interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
        """
        try:
            ticker = yf.Ticker(symbol)
            
            # Map interval to yfinance period
            period_map = {
                '1m': '1d', '2m': '1d', '5m': '1d', '15m': '5d',
                '30m': '1mo', '60m': '3mo', '90m': '3mo', '1h': '3mo',
                '1d': '1y', '5d': '2y', '1wk': '5y', '1mo': '10y', '3mo': 'max'
            }
            period = period_map.get(interval, '1y')
            
            hist = ticker.history(period=period, interval=interval)
            
            candles = []
            for idx, row in hist.iterrows():
                timestamp = int(idx.timestamp())
                candles.append({
                    'time': timestamp,
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': float(row['Volume']) if 'Volume' in row else 0
                })
            
            return candles
        except Exception as e:
            print(f"YFinance error for {symbol}: {e}")
            return []
    
    def subscribe_to_live_updates(self, symbol: str, callback: Callable[[Dict[str, Any]], None]) -> bool:
        """YFinance doesn't support real-time websockets, so we simulate with polling hint"""
        self._subscriptions[symbol] = callback
        return True
    
    def unsubscribe_from_live_updates(self, symbol: str) -> bool:
        if symbol in self._subscriptions:
            del self._subscriptions[symbol]
            return True
        return False
    
    def push_update(self, symbol: str, data: Dict[str, Any]):
        """Manually push an update (for polling scenarios)"""
        if symbol in self._subscriptions:
            self._subscriptions[symbol](data)


class HyperliquidProvider(DataProvider):
    """Hyperliquid WebSocket provider for crypto perpetuals"""
    
    def __init__(self, socketio=None):
        self._socketio = socketio
        self._subscriptions: Dict[str, Callable] = {}
        self._ws = None
        self._connected = False
    
    def set_socketio(self, socketio):
        """Set SocketIO instance for forwarding updates"""
        self._socketio = socketio
    
    def get_historical_data(self, symbol: str, interval: str) -> List[Dict[str, Any]]:
        """
        Hyperliquid doesn't provide historical data via public API.
        Return empty list - frontend will show live data only.
        """
        return []
    
    def subscribe_to_live_updates(self, symbol: str, callback: Callable[[Dict[str, Any]], None]) -> bool:
        """Register callback for live updates"""
        self._subscriptions[symbol] = callback
        return True
    
    def unsubscribe_from_live_updates(self, symbol: str) -> bool:
        if symbol in self._subscriptions:
            del self._subscriptions[symbol]
            return True
        return False
    
    def handle_price_update(self, symbol: str, data: Dict[str, Any]):
        """Handle incoming price update from WebSocket"""
        if symbol in self._subscriptions:
            self._subscriptions[symbol](data)
        
        # Also emit via SocketIO to frontend
        if self._socketio:
            self._socketio.emit('price_update', {
                'symbol': symbol,
                'data': data
            })


# Factory pattern for easy extensibility
PROVIDER_REGISTRY = {
    'yfinance': YFinanceProvider,
    'hyperliquid': HyperliquidProvider,
}


def get_provider(provider_name: str, **kwargs) -> DataProvider:
    """Factory function to get a data provider instance"""
    if provider_name not in PROVIDER_REGISTRY:
        raise ValueError(f"Unknown provider: {provider_name}")
    
    return PROVIDER_REGISTRY[provider_name](**kwargs)


# Example of how to add a new provider (e.g., Alpaca):
# class AlpacaProvider(DataProvider):
#     def get_historical_data(self, symbol: str, interval: str) -> List[Dict[str, Any]]:
#         # Implementation here
#         pass
#     
#     def subscribe_to_live_updates(self, symbol: str, callback: Callable) -> bool:
#         # Implementation here
#         pass
#     
#     def unsubscribe_from_live_updates(self, symbol: str) -> bool:
#         # Implementation here
#         pass
# 
# Then register: PROVIDER_REGISTRY['alpaca'] = AlpacaProvider
