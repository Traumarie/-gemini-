#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM代理服务监控模块
提供请求统计、状态码监控和日志分析功能
"""

import asyncio
import json
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

class RequestMonitor:
    """请求监控器，用于统计各种请求指标"""
    
    def __init__(self, max_log_entries: int = 1000):
        self.max_log_entries = max_log_entries
        
        # 请求统计
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.truncated_responses = 0
        
        # HTTP状态码统计
        self.status_codes = defaultdict(int)
        
        # API密钥使用情况
        self.api_key_usage = defaultdict(int)
        self.api_key_failures = defaultdict(int)
        
        # 响应时间统计
        self.response_times = deque(maxlen=100)
        
        # 最近日志
        self.recent_logs = deque(maxlen=max_log_entries)
        
        # 错误详情
        self.error_details = deque(maxlen=100)
        
        # 时间窗口统计（最近1小时）
        self.hourly_stats = deque(maxlen=60)  # 每分钟一个数据点
        
        # 启动时间
        self.start_time = datetime.now()
        
        # 锁，确保线程安全
        self._lock = asyncio.Lock()
    
    async def record_request(self, 
                           api_key: str, 
                           status_code: int, 
                           response_time: float,
                           response_length: int = 0,
                           min_length: int = 0,
                           error_msg: Optional[str] = None):
        """记录一次请求"""
        async with self._lock:
            self.total_requests += 1
            
            # 记录状态码
            self.status_codes[status_code] += 1
            
            # 记录API密钥使用
            self.api_key_usage[api_key] += 1
            
            # 判断成功或失败
            if 200 <= status_code < 300:
                self.successful_requests += 1
                
                # 检查是否被截断
                if response_length > 0 and response_length < min_length:
                    self.truncated_responses += 1
                    await self.add_log("WARNING", f"响应被截断: {response_length} < {min_length}", {
                        "api_key": api_key[:8] + "...",
                        "response_length": response_length,
                        "min_length": min_length
                    })
            else:
                self.failed_requests += 1
                self.api_key_failures[api_key] += 1
                
                # 记录错误详情
                if error_msg:
                    self.error_details.append({
                        "timestamp": datetime.now().isoformat(),
                        "api_key": api_key[:8] + "...",
                        "status_code": status_code,
                        "error": error_msg,
                        "response_time": response_time
                    })
            
            # 记录响应时间
            self.response_times.append(response_time)
            
            # 添加日志
            log_level = "INFO" if 200 <= status_code < 300 else "ERROR"
            await self.add_log(log_level, f"请求完成: {status_code}", {
                "api_key": api_key[:8] + "...",
                "response_time": f"{response_time:.2f}s",
                "response_length": response_length
            })
    
    async def add_log(self, level: str, message: str, details: Dict[str, Any] = None):
        """添加日志条目"""
        async with self._lock:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "level": level,
                "message": message,
                "details": details or {}
            }
            self.recent_logs.append(log_entry)
    
    async def get_stats(self) -> Dict[str, Any]:
        """获取当前统计信息"""
        async with self._lock:
            # 计算平均响应时间
            avg_response_time = 0
            if self.response_times:
                avg_response_time = sum(self.response_times) / len(self.response_times)
            
            # 计算成功率
            success_rate = 0
            if self.total_requests > 0:
                success_rate = (self.successful_requests / self.total_requests) * 100
            
            # 获取最常见的错误状态码
            error_status_codes = {
                code: count for code, count in self.status_codes.items()
                if code >= 400
            }
            
            # 获取运行时间
            uptime = datetime.now() - self.start_time
            
            return {
                "total_requests": self.total_requests,
                "successful_requests": self.successful_requests,
                "failed_requests": self.failed_requests,
                "truncated_responses": self.truncated_responses,
                "success_rate": round(success_rate, 2),
                "avg_response_time": round(avg_response_time, 2),
                "status_codes": dict(self.status_codes),
                "error_status_codes": error_status_codes,
                "uptime": str(uptime).split('.')[0],  # 去掉微秒
                "start_time": self.start_time.isoformat(),
                "api_keys_total": len(self.api_key_usage),
                "api_keys_failed": len([k for k, v in self.api_key_failures.items() if v > 0])
            }
    
    async def get_recent_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """获取最近日志"""
        async with self._lock:
            return list(self.recent_logs)[-limit:]
    
    async def get_error_details(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取错误详情"""
        async with self._lock:
            return list(self.error_details)[-limit:]
    
    async def reset_stats(self):
        """重置统计信息"""
        async with self._lock:
            self.total_requests = 0
            self.successful_requests = 0
            self.failed_requests = 0
            self.truncated_responses = 0
            self.status_codes.clear()
            self.api_key_usage.clear()
            self.api_key_failures.clear()
            self.response_times.clear()
            self.recent_logs.clear()
            self.error_details.clear()
            self.start_time = datetime.now()

# 全局监控器实例
monitor = RequestMonitor()

class MonitorMiddleware:
    """FastAPI中间件，用于自动记录请求"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        
        start_time = time.time()
        
        # 获取请求信息
        method = scope.get("method", "GET")
        path = scope.get("path", "/")
        
        # 创建响应包装器
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_code = message["status"]
                response_time = time.time() - start_time
                
                # 记录请求（简化版本，实际使用时需要更复杂的处理）
                await monitor.add_log("INFO", f"{method} {path}", {
                    "status_code": status_code,
                    "response_time": round(response_time, 3)
                })
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)

# 用于FastAPI的路由
async def get_monitor_stats():
    """获取监控统计信息"""
    return await monitor.get_stats()

async def get_monitor_logs(limit: int = 50):
    """获取监控日志"""
    return {
        "logs": await monitor.get_recent_logs(limit),
        "errors": await monitor.get_error_details(20)
    }

async def reset_monitor_stats():
    """重置监控统计"""
    await monitor.reset_stats()
    return {"success": True, "message": "监控统计已重置"}