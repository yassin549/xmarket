import { useState, useEffect } from 'react'

function EventsList({ symbol }) {
    const [events, setEvents] = useState([])

    useEffect(() => {
        fetch(`/api/v1/events/${symbol}?limit=10`)
            .then(res => res.json())
            .then(data => setEvents(data))
            .catch(err => console.error(err))
    }, [symbol])

    return (
        <div>
            <h3>Recent Events</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {events.map(event => (
                    <div key={event.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                        <p><strong>{event.summary}</strong></p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Impact: {event.impact_points > 0 ? '+' : ''}{event.impact_points.toFixed(2)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default EventsList
