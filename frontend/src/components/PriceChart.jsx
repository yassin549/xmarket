import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

function PriceChart({ symbol }) {
    const data = {
        labels: ['10:00', '10:30', '11:00', '11:30', '12:00'],
        datasets: [
            {
                label: 'Final Price',
                data: [50, 52, 54, 53, 55],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4
            },
            {
                label: 'Reality Score',
                data: [48, 51, 56, 54, 57],
                borderColor: '#10b981',
                borderDash: [5, 5],
                tension: 0.4
            }
        ]
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: `${symbol} Price History` }
        },
        scales: {
            y: { beginAtZero: false, min: 40, max: 60 }
        }
    }

    return <div style={{ height: '400px' }}><Line data={data} options={options} /></div>
}

export default PriceChart
