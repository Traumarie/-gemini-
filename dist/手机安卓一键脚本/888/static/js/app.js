// LLM代理服务 - Termux版 JavaScript
// 专为Android Termux环境优化

class LLMProxyApp {
    constructor() {
        this.currentConfig = null;
        this.init();
    }

    init() {
        try {
            console.log('初始化LLM代理服务应用...');
            this.initEventListeners();
            this.updateWebUrl();
            this.checkTermuxEnvironment();
            this.loadConfig();
            this.loadStats();
            this.startStatsRefresh();
            console.log('应用初始化完成');
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showNotification('应用初始化失败: ' + error.message, 'error');
        }
    }

    checkTermuxEnvironment() {
        // 检测是否在Termux环境中
        const isTermux = /termux/i.test(navigator.userAgent) ||
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';
        
        if (isTermux) {
            document.body.classList.add('termux-environment');
            console.log('Termux环境检测成功');
        }
    }

    initEventListeners() {
        try {
            // 等待DOM完全加载
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.bindEvents();
                });
            } else {
                this.bindEvents();
            }
        } catch (error) {
            console.error('事件监听器初始化失败:', error);
        }
    }

    bindEvents() {
        try {
            // 移动端导航
            const navButtons = document.querySelectorAll('.nav-btn');
            console.log('找到导航按钮数量:', navButtons.length);
            
            navButtons.forEach((btn, index) => {
                console.log(`绑定按钮 ${index + 1}:`, btn);
                if (btn) {
                    // 移除之前的事件监听器（防止重复绑定）
                    btn.replaceWith(btn.cloneNode(true));
                    
                    // 获取新的按钮引用
                    const newBtn = document.querySelectorAll('.nav-btn')[index];
                    if (newBtn) {
                        newBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const tabName = newBtn.dataset.tab;
                            console.log('点击按钮，切换到标签:', tabName);
                            if (tabName) {
                                this.switchTab(tabName);
                            }
                        });
                        
                        // 添加键盘支持
                        newBtn.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                const tabName = newBtn.dataset.tab;
                                if (tabName) {
                                    this.switchTab(tabName);
                                }
                            }
                        });
                    }
                }
            });

            // 按钮事件 - 使用更健壮的选择器
            this.bindButtonEvent('save-config-btn', () => this.saveConfig());
            this.bindButtonEvent('reload-config-btn', () => this.loadConfig());
            this.bindButtonEvent('quick-start-btn', () => this.startServer());
            this.bindButtonEvent('quick-stop-btn', () => this.stopServer());
            this.bindButtonEvent('reset-stats-btn', () => this.resetStats());

            // 简化实时配置更新，只在移动端使用
            this.setupMobileConfigUpdate();
        } catch (error) {
            console.error('绑定事件失败:', error);
        }
    }

    bindButtonEvent(buttonId, handler) {
        const button = document.getElementById(buttonId);
        if (button) {
            // 移除之前的事件监听器（防止重复绑定）
            button.replaceWith(button.cloneNode(true));
            
            // 获取新的按钮引用
            const newButton = document.getElementById(buttonId);
            if (newButton) {
                newButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!newButton.disabled) {
                        handler();
                    }
                });
                
                // 添加键盘支持
                newButton.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!newButton.disabled) {
                            handler();
                        }
                    }
                });
                
                console.log(`按钮 ${buttonId} 事件绑定成功`);
            }
        } else {
            console.error(`按钮 ${buttonId} 未找到`);
        }
    }

    setupMobileConfigUpdate() {
        // 为关键配置输入框添加实时更新事件
        const criticalInputs = ['api-key', 'api-port', 'api-host'];
        
        criticalInputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                element.addEventListener('change', () => {
                    this.debounce(this.saveConfig.bind(this), 2000)();
                });
            }
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async switchTab(tabName) {
        try {
            console.log('切换标签页:', tabName);
            
            // 更新导航状态
            const navButtons = document.querySelectorAll('.nav-btn');
            console.log('导航按钮数量:', navButtons.length);
            
            navButtons.forEach(btn => {
                btn.classList.remove('active');
                console.log('移除按钮激活状态:', btn);
            });
            
            const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
                console.log('激活按钮:', activeBtn);
            } else {
                console.error('未找到对应标签的按钮:', tabName);
            }

            // 切换内容
            const tabContents = document.querySelectorAll('.tab-content');
            console.log('标签页内容数量:', tabContents.length);
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                console.log('隐藏标签页内容:', content);
            });
            
            const targetTab = document.getElementById(`${tabName}-tab`);
            if (targetTab) {
                targetTab.classList.add('active');
                console.log('显示标签页内容:', targetTab);
                
                // 滚动到顶部
                targetTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                console.error('未找到对应标签页内容:', `${tabName}-tab`);
            }
        } catch (error) {
            console.error('切换标签页失败:', error);
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error('加载配置失败');
            }

            const data = await response.json();
            this.currentConfig = data;
            this.updateConfigUI(data);
            this.showNotification('配置加载成功', 'success');
        } catch (error) {
            console.error('加载配置失败:', error);
            this.showNotification('加载配置失败: ' + error.message, 'error');
        }
    }

    updateConfigUI(data) {
        // 更新服务器配置 - 简化版本
        if (data.server) {
            this.updateInputValue('api-port', data.server.port);
            this.updateInputValue('api-host', data.server.host);
            this.updateInputValue('api-key', data.server.api_key);
            this.updateInputValue('min-length', data.server.min_response_length);
            this.updateInputValue('timeout', data.server.request_timeout);
            this.updateInputValue('base-url', data.base_url);
        }

        // 更新API密钥 - 简化显示
        if (data.api_keys) {
            this.updateInputValue('group1-keys', data.api_keys.group1.join('\n'));
            this.updateInputValue('group2-keys', data.api_keys.group2.join('\n'));
        }
    }

    updateInputValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.value = value;
        }
    }

    async saveConfig() {
        try {
            const config = this.getConfigFromUI();
            
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                throw new Error('保存配置失败');
            }

            const result = await response.json();
            if (result.success) {
                // 显示更详细的成功消息
                const message = result.message || '配置保存成功';
                this.showNotification(message, 'success');
                this.currentConfig = config;
                this.updateApiKeyDisplay();
                
                // 如果保存的是API密钥，显示额外提示
                if (config.api_keys && (config.api_keys.group1.length > 0 || config.api_keys.group2.length > 0)) {
                    setTimeout(() => {
                        this.showNotification('API密钥已更新，新的请求将立即使用新密钥', 'info');
                    }, 1000);
                }
            } else {
                throw new Error(result.error || '保存配置失败');
            }
        } catch (error) {
            console.error('保存配置失败:', error);
            this.showNotification('保存配置失败: ' + error.message, 'error');
        }
    }

    getConfigFromUI() {
        return {
            server: {
                port: this.getIntValue('api-port', 8080),
                host: this.getTextValue('api-host', '0.0.0.0'),
                web_port: this.getIntValue('api-port', 8080), // 统一端口配置
                web_host: this.getTextValue('api-host', '0.0.0.0'),
                api_key: this.getTextValue('api-key', '123'),
                min_response_length: this.getIntValue('min-length', 300),
                request_timeout: this.getIntValue('timeout', 120)
            },
            api_keys: {
                group1: this.getTextAreaValue('group1-keys'),
                group2: this.getTextAreaValue('group2-keys')
            },
            base_url: this.getTextValue('base-url', 'https://generativelanguage.googleapis.com/v1beta')
        };
    }

    getIntValue(elementId, defaultValue) {
        const element = document.getElementById(elementId);
        return element ? parseInt(element.value) || defaultValue : defaultValue;
    }

    getTextValue(elementId, defaultValue) {
        const element = document.getElementById(elementId);
        return element ? element.value : defaultValue;
    }

    getTextAreaValue(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return [];
        
        return element.value
            .split('\n')
            .map(key => key.trim())
            .filter(key => key.length > 0);
    }

    async startServer() {
        try {
            this.setButtonLoading('quick-start-btn', true);
            
            const response = await fetch('/api/server/start', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('启动服务器失败');
            }

            const result = await response.json();
            if (result.success) {
                this.showNotification('API服务器启动成功', 'success');
                this.updateServerButtons(true);
                this.updateServerStatus({ status: 'running', url: result.url });
            } else {
                throw new Error(result.error || '启动服务器失败');
            }
        } catch (error) {
            console.error('启动服务器失败:', error);
            this.showNotification('启动服务器失败: ' + error.message, 'error');
        } finally {
            this.setButtonLoading('quick-start-btn', false);
        }
    }

    async stopServer() {
        try {
            this.setButtonLoading('quick-stop-btn', true);
            
            const response = await fetch('/api/server/stop', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('停止服务器失败');
            }

            const result = await response.json();
            if (result.success) {
                this.showNotification('API服务器停止成功', 'success');
                this.updateServerButtons(false);
                this.updateServerStatus({ status: 'stopped' });
            } else {
                throw new Error(result.error || '停止服务器失败');
            }
        } catch (error) {
            console.error('停止服务器失败:', error);
            this.showNotification('停止服务器失败: ' + error.message, 'error');
        } finally {
            this.setButtonLoading('quick-stop-btn', false);
        }
    }

    updateServerStatus(data) {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        const apiStatus = document.getElementById('api-status');
        const apiUrl = document.getElementById('api-url');

        if (data.status === 'running') {
            if (statusIndicator) statusIndicator.className = 'status-indicator status-running';
            if (statusText) statusText.textContent = '服务运行中';
            
            if (apiStatus) {
                apiStatus.className = 'badge bg-success';
                apiStatus.textContent = '运行中';
            }
            
            if (apiUrl && data.url) {
                apiUrl.textContent = data.url;
            }
            
            this.updateServerButtons(true);
        } else {
            if (statusIndicator) statusIndicator.className = 'status-indicator status-stopped';
            if (statusText) statusText.textContent = '服务未运行';
            
            if (apiStatus) {
                apiStatus.className = 'badge bg-secondary';
                apiStatus.textContent = '未运行';
            }
            
            if (apiUrl) {
                apiUrl.textContent = '-';
            }
            
            this.updateServerButtons(false);
        }
    }

    updateServerButtons(isRunning) {
        const quickStartBtn = document.getElementById('quick-start-btn');
        const quickStopBtn = document.getElementById('quick-stop-btn');

        if (quickStartBtn) quickStartBtn.disabled = isRunning;
        if (quickStopBtn) quickStopBtn.disabled = !isRunning;
    }

    updateApiKeyDisplay() {
        const apiKeyInput = document.getElementById('api-key');
        const currentApiKey = document.getElementById('current-api-key');
        if (apiKeyInput && currentApiKey) {
            currentApiKey.textContent = apiKeyInput.value || '123';
        }
    }

    updateWebUrl() {
        const webUrl = document.getElementById('web-url');
        if (webUrl) {
            const protocol = window.location.protocol;
            const host = window.location.host;
            webUrl.textContent = `${protocol}//${host}`;
        }
    }

    setButtonLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            const originalText = button.innerHTML;
            button.dataset.originalText = originalText;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>处理中...';
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        container.appendChild(notification);

        // 自动隐藏
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) {
                throw new Error('加载统计失败');
            }

            const data = await response.json();
            this.updateStatsUI(data);
        } catch (error) {
            console.error('加载统计失败:', error);
        }
    }

    updateStatsUI(data) {
        if (!data || !data.stats) return;

        const stats = data.stats;
        
        // 更新统计数字
        this.updateElementText('total-requests', stats.total_requests);
        this.updateElementText('successful-requests', stats.successful_requests);
        this.updateElementText('failed-requests', stats.failed_requests);
        this.updateElementText('truncated-requests', stats.truncated_requests);
        this.updateElementText('rate-limited-requests', stats.rate_limited_requests);
        this.updateElementText('timeout-requests', stats.timeout_requests);
        
        // 更新成功率
        this.updateElementText('success-rate', data.success_rate + '%');
        
        // 更新进度条
        const successBar = document.getElementById('success-rate-bar');
        if (successBar) {
            successBar.style.width = data.success_rate + '%';
            successBar.textContent = data.success_rate + '%';
        }
    }

    updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    startStatsRefresh() {
        // 每5秒刷新一次统计信息
        setInterval(() => {
            this.loadStats();
        }, 5000);
    }

    async resetStats() {
        try {
            const response = await fetch('/api/stats/reset', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('重置统计失败');
            }

            const result = await response.json();
            if (result.success) {
                this.showNotification('统计信息已重置', 'success');
                this.loadStats(); // 立即刷新显示
            }
        } catch (error) {
            console.error('重置统计失败:', error);
            this.showNotification('重置统计失败: ' + error.message, 'error');
        }
    }
}

// 扩展updateServerButtons方法以同步快速启动和停止按钮的状态
document.addEventListener('DOMContentLoaded', function() {
    // 保存原始方法
    const originalUpdateServerButtons = LLMProxyApp.prototype.updateServerButtons;
    
    // 扩展方法
    LLMProxyApp.prototype.updateServerButtons = function(isRunning) {
        // 调用原始方法
        originalUpdateServerButtons.call(this, isRunning);
        
        // 同步快速启动和停止按钮的状态
        const quickStartBtn = document.getElementById('quick-start-btn');
        const quickStopBtn = document.getElementById('quick-stop-btn');
        
        if (quickStartBtn) quickStartBtn.disabled = isRunning;
        if (quickStopBtn) quickStopBtn.disabled = !isRunning;
    };
});

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('DOM已加载，初始化应用...');
        
        // 确保所有依赖项都可用
        if (typeof fetch === 'undefined') {
            console.error('Fetch API不可用');
            return;
        }
        
        window.llmProxyApp = new LLMProxyApp();
        console.log('应用初始化成功');
    } catch (error) {
        console.error('应用初始化失败:', error);
    }
});

// 添加全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
    });
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});