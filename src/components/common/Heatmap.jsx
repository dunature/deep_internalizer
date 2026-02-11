/**
 * GitHub-style Heatmap Component
 * Visualizes daily progress: segments completed + words archived
 */
import { useMemo } from 'react';
import styles from './Heatmap.module.css';

// Generate last N days
function generateDays(count = 365) {
    const days = [];
    const today = new Date();

    for (let i = count - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
    }

    return days;
}

// Get intensity level (0-4) based on activity count
function getIntensity(count) {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 10) return 3;
    return 4;
}

// Get month labels
function getMonthLabels(days) {
    const months = [];
    let currentMonth = null;

    days.forEach((day, index) => {
        const month = new Date(day).toLocaleDateString('en-US', { month: 'short' });
        if (month !== currentMonth) {
            months.push({ label: month, index });
            currentMonth = month;
        }
    });

    return months;
}

export default function Heatmap({ data = {}, onDayClick }) {
    const days = useMemo(() => generateDays(365), []);
    const monthLabels = useMemo(() => getMonthLabels(days), [days]);

    // Group days by week
    const weeks = useMemo(() => {
        const result = [];
        let week = [];

        // Pad first week
        const firstDay = new Date(days[0]).getDay();
        for (let i = 0; i < firstDay; i++) {
            week.push(null);
        }

        days.forEach((day) => {
            week.push(day);
            if (week.length === 7) {
                result.push(week);
                week = [];
            }
        });

        if (week.length > 0) {
            result.push(week);
        }

        return result;
    }, [days]);

    // Calculate stats
    const stats = useMemo(() => {
        const values = Object.values(data);
        const total = values.reduce((sum, d) => sum + (d.segments || 0) + (d.words || 0), 0);
        const activeDays = values.filter(d => (d.segments || 0) + (d.words || 0) > 0).length;
        const maxStreak = calculateStreak(days, data);

        return { total, activeDays, maxStreak };
    }, [data, days]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h3>📊 Learning Activity</h3>
                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{stats.total}</span>
                        <span className={styles.statLabel}>Total Activities</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{stats.activeDays}</span>
                        <span className={styles.statLabel}>Active Days</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{stats.maxStreak}</span>
                        <span className={styles.statLabel}>Max Streak</span>
                    </div>
                </div>
            </header>

            <div className={styles.heatmapWrapper}>
                {/* Month labels */}
                <div className={styles.monthLabels}>
                    {monthLabels.map(({ label, index }) => (
                        <span
                            key={`${label}-${index}`}
                            className={styles.monthLabel}
                            style={{ left: `${(index / days.length) * 100}%` }}
                        >
                            {label}
                        </span>
                    ))}
                </div>

                {/* Day labels */}
                <div className={styles.dayLabels}>
                    <span>Mon</span>
                    <span>Wed</span>
                    <span>Fri</span>
                </div>

                {/* Grid */}
                <div className={styles.grid}>
                    {weeks.map((week, weekIndex) => (
                        <div key={weekIndex} className={styles.week}>
                            {week.map((day, dayIndex) => (
                                <DayCell
                                    key={day || `empty-${weekIndex}-${dayIndex}`}
                                    day={day}
                                    data={day ? data[day] : null}
                                    onClick={onDayClick}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className={styles.legend}>
                    <span className={styles.legendLabel}>Less</span>
                    {[0, 1, 2, 3, 4].map(level => (
                        <div
                            key={level}
                            className={`${styles.cell} ${styles[`level${level}`]}`}
                        />
                    ))}
                    <span className={styles.legendLabel}>More</span>
                </div>
            </div>
        </div>
    );
}

function DayCell({ day, data, onClick }) {
    if (!day) {
        return <div className={styles.emptyCell} />;
    }

    const count = data ? (data.segments || 0) + (data.words || 0) : 0;
    const intensity = getIntensity(count);
    const dateStr = new Date(day).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    return (
        <div
            className={`${styles.cell} ${styles[`level${intensity}`]}`}
            onClick={() => onClick?.(day, data)}
            title={`${dateStr}: ${count} activities`}
        />
    );
}

function calculateStreak(days, data) {
    let maxStreak = 0;
    let currentStreak = 0;

    for (const day of days) {
        const dayData = data[day];
        const hasActivity = dayData && ((dayData.segments || 0) + (dayData.words || 0) > 0);

        if (hasActivity) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    }

    return maxStreak;
}
