#!/bin/bash
# LLM代理服务 - Termux启动脚本
# 专为中转服务设计，确保永不休眠

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== LLM代理服务 - Termux中转版 ===${NC}"
echo -e "${BLUE}永不休眠模式已激活${NC}"
echo ""

# 防止休眠的函数
prevent_sleep() {
    if [[ -d /data/data/com.termux/files/usr ]]; then
        # Termux保持唤醒
        termux-wake-lock 2>/dev/null || echo -e "${YELLOW}⚠  需要安装termux-wake-lock${NC}"
        
        # 设置CPU性能模式
        echo performance > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || true
        
        # 防止网络休眠
        if command -v termux-wifi-enable &> /dev/null; then
            termux-wifi-enable true 2>/dev/null || true
        fi
    fi
}

# 检测是否在Termux环境中
if [[ -d /data/data/com.termux/files/usr ]]; then
    echo -e "${GREEN}✓ 检测到Termux环境${NC}"
    IS_TERMUX=true
    
    # 安装必要的Termux插件
    echo -e "${YELLOW}检查Termux插件...${NC}"
    pkg install termux-api termux-wake-lock 2>/dev/null || echo -e "${YELLOW}⚠  部分插件安装失败${NC}"
else
    echo -e "${YELLOW}! 未检测到Termux环境${NC}"
    IS_TERMUX=false
fi

# 检测Python版本
PYTHON_VERSION=$(python3 --version 2>/dev/null || python --version 2>/dev/null)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}✗ 未检测到Python，请先安装：${NC}"
    echo "  pkg install python"
    exit 1
fi
echo -e "${GREEN}✓ 检测到 $PYTHON_VERSION${NC}"

# 安装依赖
echo -e "${YELLOW}检查依赖...${NC}"
if [[ $IS_TERMUX == true ]]; then
    # Termux使用国内镜像
    python3 -m pip install -r requirements_termux.txt -i https://pypi.tuna.tsinghua.edu.cn/simple/
else
    python3 -m pip install -r requirements.txt
fi

if [[ $? -ne 0 ]]; then
    echo -e "${RED}✗ 依赖安装失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 依赖检查完成${NC}"

# 获取本地IP地址
get_local_ip() {
    if command -v ip &> /dev/null; then
        ip route get 1 | awk '{print $7}' | head -1
    elif command -v ifconfig &> /dev/null; then
        ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1
    else
        hostname -I | awk '{print $1}'
    fi
}

LOCAL_IP=$(get_local_ip)

# 显示使用说明
echo ""
echo -e "${GREEN}=== 中转服务配置 ===${NC}"
echo -e "${BLUE}⚡ 永不休眠模式已启用${NC}"
echo "1. 服务启动后，可以通过以下地址访问："
echo "   - 本机访问: http://localhost:5000"
echo "   - 局域网访问: http://$LOCAL_IP:5000"
echo ""
echo "2. 服务特性："
echo "   - ✓ 持续运行，永不休眠"
echo "   - ✓ 自动保持网络连接"
echo "   - ✓ CPU性能模式"
echo "   - ✓ 内存优化"
echo ""
echo "3. 管理命令："
echo "   - 启动服务: ./start_termux.sh"
echo "   - 后台运行: nohup ./start_termux.sh > llm_proxy.log 2>&1 &"
echo "   - 查看状态: tail -f llm_proxy.log"
echo "   - 停止服务: pkill -f app.py"
echo ""

# 启动前准备
echo -e "${YELLOW}正在准备启动...${NC}"

# 防止休眠
prevent_sleep

# 设置环境变量确保不中断
export FLASK_ENV=production
export PYTHONUNBUFFERED=1
export PYTHONDONTWRITEBYTECODE=1

# 启动服务
echo -e "${GREEN}正在启动中转服务...${NC}"
echo -e "${BLUE}服务将持续运行，按Ctrl+C停止${NC}"
echo ""

# 启动服务并确保持续运行
while true; do
    python3 app.py 2>&1 | while IFS= read -r line; do
        echo "[$(date '+%H:%M:%S')] $line"
    done
    
    # 如果服务意外退出，等待3秒后重启
    echo -e "${RED}服务意外退出，3秒后重启...${NC}"
    sleep 3
done