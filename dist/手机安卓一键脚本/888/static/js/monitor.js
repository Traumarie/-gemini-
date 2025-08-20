/**
 * 监控功能前端实现
 */

class MonitorManager {
    constructor() {
        this.refreshInterval = null;
        this.autoRefresh = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadStats();
        this.loadLogs();
    }

    bindEvents() {
        // 刷新按钮
        document.getElementById('refresh-stats-btn')?.addEventListener('click', () => {
            this.loadStats();
            this.loadLogs();
        });

        // 重置按钮
        document.getElementById('reset-stats-btn')?.addEventListener('click', () => {
            this.resetStats();
        });

        // 标签页切换时自动刷新
        document.addEventListener('tabChanged', (e) => {
            if (e.detail.tabId === 'monitor-tab') {
                this.loadStats();
                this.loadLogs();
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
    }

    async loadStats() {
        try {
            const response = await fetch('/api/monitor/stats');
            const data = await response.json();
            
            if (data.success) {
                this.updateStatsDisplay(data.data);
            }
        } catch (error) {
            console.error('加载监控统计失败:', error);
        }
    }

    async loadLogs() {
        try {
            const response = await fetch('/api/monitor/logs?limit=20');
            const data = await response.json();
            
            if (data.success) {
                this.updateLogsDisplay(data.logs, data.errors);
            }
        } catch (error) {
            console.error('加载监控日志失败:', error);
        }
    }

    updateStatsDisplay(stats) {
        // 更新统计数字
        document.getElementById('total-requests').textContent = stats.total_requests || 0;
        document.getElementById('success-rate').textContent = `${stats.success_rate || 0}%`;
        document.getElementById('truncated-count').textContent = stats.truncated_responses || 0;
        document.getElementById('avg-time').textContent = `${stats.avg_response_time || 0}s`;
        
        // 更新运行时间
        document.getElementById('uptime').textContent = stats.uptime || '-';
        document.getElementById('start-time').textContent = stats.start_time ? 
            new Date(stats.start_time).toLocaleString() : '-';
        
        // 更新状态码分布
        this.updateStatusCodes(stats.error_status_codes || {});
    }

    updateStatusCodes(statusCodes) {
        const container = document.getElementById('status-codes');
        if (!container) return;
        
        container.innerHTML = '';
        
        // 重要状态码
        const importantCodes = [429, 503, 500, 401, 403];
        
        importantCodes.forEach(code => {
            if (statusCodes[code] > 0) {
                const badge = document.createElement('span');
                badge.className = 'badge bg-danger me-1';
                badge.textContent = `${code}: ${statusCodes[code]}`;
                badge.title = this.getStatusCodeDescription(code);
                container.appendChild(badge);
            }
        });
        
        // 其他状态码
        Object.entries(statusCodes).forEach(([code, count]) => {
            if (!importantCodes.includes(parseInt(code))) {
                const badge = document.createElement('span');
                badge.className = 'badge bg-secondary me-1';
                badge.textContent = `${code}: ${count}`;
                container.appendChild(badge);
            }
        });
    }

    getStatusCodeDescription(code) {
        const descriptions = {
            200: '成功',
            429: '请求过于频繁',
            503: '服务不可用',
            500: '服务器内部错误',
            401: '未授权',
            403: '禁止访问',
            404: '未找到',
            0: '网络错误'
        };
        return descriptions[code] || '未知状态';
    }

    updateLogsDisplay(logs, errors) {
        // 更新最近日志
        const logsContainer = document.getElementById('recent-logs');
        if (logsContainer) {
            logsContainer.innerHTML = '';
            
            logs.slice(-10).reverse().forEach(log => {
                const logDiv = document.createElement('div');
                logDiv.className = `alert alert-${this.getLogLevelClass(log.level)} py-1 px-2 mb-1`;
                logDiv.innerHTML = `
                    <small>
                        <strong>${new Date(log.timestamp).toLocaleTimeString()}</strong>
                        ${log.message}
                        ${log.details ? `<br><em>${JSON.stringify(log.details)}</em>` : ''}
                    </small>
                `;
                logsContainer.appendChild(logDiv);
            });
        }
        
        // 更新错误详情
        const errorsContainer = document.getElementById('error-details');
        if (errorsContainer) {
            errorsContainer.innerHTML = '';
            
            errors.slice(-5).reverse().forEach(error => {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'alert alert-danger py-1 px-2 mb-1';
                errorDiv.innerHTML = `
                    <small>
                        <strong>${new Date(error.timestamp).toLocaleTimeString()}</strong>
                        状态码: ${error.status_code}<br>
                        ${error.error}
                    </small>
                `;
                errorsContainer.appendChild(errorDiv);
            });
        }
    }

    getLogLevelClass(level) {
        const classes = {
            'INFO': 'info',
            'WARNING': 'warning',
            'ERROR': 'danger',
            'DEBUG': 'secondary'
        };
        return classes[level] || 'secondary';
    }

    async resetStats() {
        if (!confirm('确定要重置所有监控统计吗？')) return;
        
        try {
            const response = await fetch('/api/monitor/reset', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.loadStats();
                this.loadLogs();
                alert('监控统计已重置');
            }
        } catch (error) {
            console.error('重置监控统计失败:', error);
            alert('重置失败: ' + error.message);
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) return;
        
        this.refreshInterval = setInterval(() => {
            this.loadStats();
            this.loadLogs();
        }, 5000); // 每5秒刷新一次
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// 初始化监控管理器
document.addEventListener('DOMContentLoaded', () => {
    window.monitorManager = new MonitorManager();
});