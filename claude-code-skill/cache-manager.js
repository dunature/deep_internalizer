/**
 * Deep Internalizer - Cache Manager
 * 管理分析结果的缓存，支持快速查找和去重
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 缓存目录
const CACHE_DIR = process.env.DEEP_INTERNALIZER_CACHE_DIR ||
                  path.join(require('os').homedir(), '.deep-internalizer', 'cache');

// 缓存数据结构
class CacheEntry {
    constructor({ contentHash, taskId, title, url, analyzedAt, model, chunkCount, status }) {
        this.contentHash = contentHash;
        this.taskId = taskId;
        this.title = title;
        this.url = url;
        this.analyzedAt = analyzedAt || new Date().toISOString();
        this.model = model;
        this.chunkCount = chunkCount;
        this.status = status || 'done';
    }
}

// 初始化缓存目录
function initCache() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        console.log(`[Cache] 创建缓存目录：${CACHE_DIR}`);
    }
}

/**
 * 生成内容哈希 (SHA-256)
 */
function hashContent(content) {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * 获取短哈希（前 16 字符）
 */
function shortHash(content) {
    return hashContent(content).substring(0, 16);
}

/**
 * 检查缓存是否存在
 * @param {string} contentHash - 内容哈希
 * @returns {CacheEntry|null}
 */
function getCache(contentHash) {
    const cacheFile = path.join(CACHE_DIR, `${contentHash}.json`);

    if (!fs.existsSync(cacheFile)) {
        return null;
    }

    try {
        const data = fs.readFileSync(cacheFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.warn(`[Cache] 读取失败：${error.message}`);
        return null;
    }
}

/**
 * 检查内容是否已缓存
 * @param {string} content - 原始内容
 * @returns {{cached: boolean, entry: CacheEntry|null}}
 */
function checkCache(content) {
    const contentHash = hashContent(content);
    const entry = getCache(contentHash);

    return {
        cached: entry !== null,
        entry: entry
    };
}

/**
 * 保存到缓存
 * @param {CacheEntry} entry
 * @returns {boolean}
 */
function saveToCache(entry) {
    try {
        initCache();
        const cacheFile = path.join(CACHE_DIR, `${entry.contentHash}.json`);
        fs.writeFileSync(cacheFile, JSON.stringify(entry, null, 2), 'utf-8');
        console.log(`[Cache] 已保存：${entry.taskId}`);
        return true;
    } catch (error) {
        console.error(`[Cache] 保存失败：${error.message}`);
        return false;
    }
}

/**
 * 创建新的缓存条目
 * @param {Object} params
 * @returns {CacheEntry}
 */
function createCacheEntry(params) {
    const { content, taskId, title, url, model, chunkCount } = params;
    const contentHash = hashContent(content);

    return new CacheEntry({
        contentHash,
        taskId: taskId || generateUUID(),
        title,
        url,
        model,
        chunkCount,
        status: 'done'
    });
}

/**
 * 生成 UUID
 */
function generateUUID() {
    if (typeof crypto.randomUUID !== 'undefined') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * 列出所有缓存条目
 * @returns {CacheEntry[]}
 */
function listCacheEntries() {
    initCache();
    const entries = [];

    try {
        const files = fs.readdirSync(CACHE_DIR);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const cacheFile = path.join(CACHE_DIR, file);
            try {
                const data = fs.readFileSync(cacheFile, 'utf-8');
                entries.push(JSON.parse(data));
            } catch (error) {
                console.warn(`[Cache] 跳过损坏的文件：${file}`);
            }
        }
    } catch (error) {
        console.error(`[Cache] 列出失败：${error.message}`);
    }

    // 按时间倒序排列
    return entries.sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));
}

/**
 * 清理过期缓存（超过 30 天）
 */
function cleanupExpiredCache(days = 30) {
    initCache();
    const now = new Date();
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    const entries = listCacheEntries();
    for (const entry of entries) {
        const analyzedAt = new Date(entry.analyzedAt);
        if (analyzedAt < threshold) {
            const cacheFile = path.join(CACHE_DIR, `${entry.contentHash}.json`);
            try {
                fs.unlinkSync(cacheFile);
                cleaned++;
            } catch (error) {
                console.warn(`[Cache] 删除失败：${entry.contentHash}`);
            }
        }
    }

    console.log(`[Cache] 清理了 ${cleaned} 个过期条目`);
    return cleaned;
}

/**
 * 获取缓存统计信息
 */
function getCacheStats() {
    initCache();
    const entries = listCacheEntries();

    return {
        totalEntries: entries.length,
        directory: CACHE_DIR,
        byModel: entries.reduce((acc, e) => {
            acc[e.model] = (acc[e.model] || 0) + 1;
            return acc;
        }, {})
    };
}

// CLI 命令
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'list':
            console.log('缓存条目列表:');
            const entries = listCacheEntries();
            entries.forEach(e => {
                console.log(`  ${e.taskId.substring(0, 8)}... | ${e.title.substring(0, 40)}... | ${e.analyzedAt.split('T')[0]}`);
            });
            break;

        case 'stats':
            const stats = getCacheStats();
            console.log('缓存统计:');
            console.log(`  总条目数：${stats.totalEntries}`);
            console.log(`  目录：${stats.directory}`);
            console.log(`  按模型: ${JSON.stringify(stats.byModel)}`);
            break;

        case 'clean':
            const days = parseInt(args[1]) || 30;
            cleanupExpiredCache(days);
            break;

        case 'hash':
            if (!args[1]) {
                console.log('用法：cache-manager.js hash <content>');
                process.exit(1);
            }
            console.log(`SHA-256: ${hashContent(args[1])}`);
            console.log(`短哈希：${shortHash(args[1])}`);
            break;

        default:
            console.log('用法：node cache-manager.js <command>');
            console.log('命令：list, stats, clean [days], hash <content>');
    }
}

module.exports = {
    CacheEntry,
    initCache,
    hashContent,
    shortHash,
    getCache,
    checkCache,
    saveToCache,
    createCacheEntry,
    listCacheEntries,
    cleanupExpiredCache,
    getCacheStats
};
