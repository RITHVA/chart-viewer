/**
 * Trading Dashboard - Main Application
 * ES2020 Compatible JavaScript
 */

// Global state
const state = {
    socket: null,
    panes: new Map(), // paneId -> pane data
    gridColumns: 1,
    isConnected: false
};

// Default symbols and intervals
const DEFAULT_SYMBOLS = {
    yfinance: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'RELIANCE.NS', 'TCS.NS', 'INFY.NS'],
    hyperliquid: ['BTC', 'ETH', 'SOL', 'ARB', 'OP']
};

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeGrid();
    initializeSocketIO();
    setupEventListeners();
});

/**
 * Grid Management
 */
function initializeGrid() {
    const savedColumns = localStorage.getItem('gridColumns');
    state.gridColumns = savedColumns ? parseInt(savedColumns) : 1;
    
    const gridSelector = document.getElementById('grid-selector');
    gridSelector.value = state.gridColumns.toString();
    
    renderGrid();
}

function renderGrid() {
    const container = document.getElementById('grid-container');
    container.setAttribute('data-columns', state.gridColumns.toString());
    
    // Clear existing panes
    container.innerHTML = '';
    state.panes.clear();
    
    // Create panes
    for (let i = 0; i < state.gridColumns; i++) {
        createPane(i);
    }
}

function createPane(paneId) {
    const container = document.getElementById('grid-container');
    
    const pane = document.createElement('div');
    pane.className = 'chart-pane';
    pane.id = `pane-${paneId}`;
    pane.innerHTML = `
        <div class="pane-header">
            <div class="pane-controls">
                <select class="provider-select" data-pane="${paneId}">
                    <option value="yfinance">Yahoo Finance</option>
                    <option value="hyperliquid">Hyperliquid</option>
                </select>
                <input type="text" class="symbol-input" data-pane="${paneId}" placeholder="Symbol" value="${getDefaultSymbol('yfinance')}">
                <select class="timeframe-select" data-pane="${paneId}">
                    ${TIMEFRAMES.map(tf => `<option value="${tf}" ${tf === '1d' ? 'selected' : ''}>${tf}</option>`).join('')}
                </select>
                <button class="load-btn" data-pane="${paneId}">Load</button>
            </div>
            <div class="ticker-display" id="ticker-${paneId}">--</div>
        </div>
        <div class="chart-container" id="chart-container-${paneId}">
            <div class="loading-overlay" id="loading-${paneId}">
                <div class="spinner"></div>
            </div>
        </div>
    `;
    
    container.appendChild(pane);
    
    // Initialize chart
    const chartContainer = document.getElementById(`chart-container-${paneId}`);
    const chart = window.LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: {
            background: { color: '#0f0f1a' },
            textColor: '#eaeaea',
        },
        grid: {
            vertLines: { color: '#2a2a4a' },
            horzLines: { color: '#2a2a4a' },
        },
        crosshair: {
            mode: window.LightweightCharts.CrosshairMode.Normal,
        },
        timeScale: {
            borderColor: '#2a2a4a',
            timeVisible: true,
            secondsVisible: false,
        },
    });
    
    const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#00c853',
        downColor: '#ff5252',
        borderUpColor: '#00c853',
        borderDownColor: '#ff5252',
        wickUpColor: '#00c853',
        wickDownColor: '#ff5252',
    });
    
    // Store pane data
    state.panes.set(paneId, {
        chart: chart,
        series: candlestickSeries,
        symbol: getDefaultSymbol('yfinance'),
        provider: 'yfinance',
        interval: '1d',
        lastPrice: null
    });
    
    // Handle resize
    const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== chartContainer) return;
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
    });
    resizeObserver.observe(chartContainer);
    
    // Add event listeners for this pane
    setupPaneEventListeners(paneId);
}

function getDefaultSymbol(provider) {
    const symbols = DEFAULT_SYMBOLS[provider] || DEFAULT_SYMBOLS.yfinance;
    return symbols[0];
}

/**
 * Socket.IO Connection
 */
function initializeSocketIO() {
    state.socket = io();
    
    state.socket.on('connect', () => {
        state.isConnected = true;
        updateConnectionStatus(true);
        console.log('Connected to server');
        
        // Re-subscribe to all active panes
        state.panes.forEach((paneData, paneId) => {
            if (paneData.symbol) {
                subscribeToPane(paneId);
            }
        });
    });
    
    state.socket.on('disconnect', () => {
        state.isConnected = false;
        updateConnectionStatus(false);
        console.log('Disconnected from server');
    });
    
    state.socket.on('connected', (data) => {
        console.log('Server acknowledged connection:', data);
    });
    
    state.socket.on('subscribed', (data) => {
        console.log(`Subscribed to ${data.symbol} on pane ${data.pane_id}`);
    });
    
    state.socket.on('price_update', (data) => {
        handlePriceUpdate(data.symbol, data.data);
    });
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (connected) {
        statusEl.textContent = 'Connected';
        statusEl.classList.add('connected');
    } else {
        statusEl.textContent = 'Disconnected';
        statusEl.classList.remove('connected');
    }
}

/**
 * Event Listeners
 */
function setupEventListeners() {
    // Grid selector
    document.getElementById('grid-selector').addEventListener('change', (e) => {
        state.gridColumns = parseInt(e.target.value);
        localStorage.setItem('gridColumns', state.gridColumns.toString());
        renderGrid();
    });
}

function setupPaneEventListeners(paneId) {
    const providerSelect = document.querySelector(`.provider-select[data-pane="${paneId}"]`);
    const symbolInput = document.querySelector(`.symbol-input[data-pane="${paneId}"]`);
    const timeframeSelect = document.querySelector(`.timeframe-select[data-pane="${paneId}"]`);
    const loadBtn = document.querySelector(`.load-btn[data-pane="${paneId}"]`);
    
    // Update default symbol when provider changes
    providerSelect.addEventListener('change', (e) => {
        const provider = e.target.value;
        symbolInput.value = getDefaultSymbol(provider);
    });
    
    // Load button
    loadBtn.addEventListener('click', () => {
        loadPaneData(paneId);
    });
    
    // Enter key on symbol input
    symbolInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadPaneData(paneId);
        }
    });
}

/**
 * Data Loading
 */
async function loadPaneData(paneId) {
    const paneData = state.panes.get(paneId);
    if (!paneData) return;
    
    const providerSelect = document.querySelector(`.provider-select[data-pane="${paneId}"]`);
    const symbolInput = document.querySelector(`.symbol-input[data-pane="${paneId}"]`);
    const timeframeSelect = document.querySelector(`.timeframe-select[data-pane="${paneId}"]`);
    
    const provider = providerSelect.value;
    const symbol = symbolInput.value.trim().toUpperCase();
    const interval = timeframeSelect.value;
    
    if (!symbol) {
        alert('Please enter a symbol');
        return;
    }
    
    // Update pane state
    paneData.provider = provider;
    paneData.symbol = symbol;
    paneData.interval = interval;
    
    // Show loading
    showLoading(paneId, true);
    
    try {
        // Fetch historical data
        const response = await fetch(`/api/historical?symbol=${encodeURIComponent(symbol)}&interval=${interval}&provider=${provider}`);
        const result = await response.json();
        
        if (result.data && result.data.length > 0) {
            // Use setData for initial load (performance critical)
            paneData.series.setData(result.data);
            
            // Update ticker
            const lastCandle = result.data[result.data.length - 1];
            updateTicker(paneId, lastCandle.close);
        } else {
            // No historical data (e.g., Hyperliquid), clear series
            paneData.series.setData([]);
        }
        
        // Subscribe to live updates
        subscribeToPane(paneId);
        
    } catch (error) {
        console.error(`Error loading data for ${symbol}:`, error);
        alert(`Failed to load data for ${symbol}`);
    } finally {
        showLoading(paneId, false);
    }
}

function subscribeToPane(paneId) {
    const paneData = state.panes.get(paneId);
    if (!paneData || !state.isConnected) return;
    
    state.socket.emit('subscribe', {
        pane_id: paneId,
        symbol: paneData.symbol,
        provider: paneData.provider,
        interval: paneData.interval
    });
}

/**
 * Price Update Handling
 */
function handlePriceUpdate(symbol, data) {
    // Find panes displaying this symbol
    state.panes.forEach((paneData, paneId) => {
        if (paneData.symbol === symbol) {
            // Use update() for real-time updates (NOT setData - performance critical!)
            paneData.series.update(data);
            
            // Update ticker with flash effect
            updateTicker(paneId, data.close);
        }
    });
}

function updateTicker(paneId, price) {
    const paneData = state.panes.get(paneId);
    if (!paneData) return;
    
    const tickerEl = document.getElementById(`ticker-${paneId}`);
    const formattedPrice = typeof price === 'number' ? price.toFixed(2) : price;
    tickerEl.textContent = formattedPrice;
    
    // Flash effect based on price movement
    if (paneData.lastPrice !== null) {
        if (price > paneData.lastPrice) {
            tickerEl.classList.add('flash-up');
            setTimeout(() => tickerEl.classList.remove('flash-up'), 300);
        } else if (price < paneData.lastPrice) {
            tickerEl.classList.add('flash-down');
            setTimeout(() => tickerEl.classList.remove('flash-down'), 300);
        }
    }
    
    paneData.lastPrice = price;
}

/**
 * UI Helpers
 */
function showLoading(paneId, show) {
    const loadingEl = document.getElementById(`loading-${paneId}`);
    if (show) {
        loadingEl.classList.add('active');
    } else {
        loadingEl.classList.remove('active');
    }
}

// Polling for YFinance (since it doesn't support websockets)
// This simulates periodic updates for equity data
setInterval(() => {
    if (!state.isConnected) return;
    
    state.panes.forEach(async (paneData, paneId) => {
        if (paneData.provider === 'yfinance' && paneData.symbol) {
            try {
                const response = await fetch(`/api/historical?symbol=${encodeURIComponent(paneData.symbol)}&interval=${paneData.interval}&provider=yfinance`);
                const result = await response.json();
                
                if (result.data && result.data.length > 0) {
                    const lastCandle = result.data[result.data.length - 1];
                    handlePriceUpdate(paneData.symbol, lastCandle);
                }
            } catch (error) {
                // Silently fail for polling
            }
        }
    });
}, 5000); // Poll every 5 seconds for yfinance data
