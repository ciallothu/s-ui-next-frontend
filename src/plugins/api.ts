import axios from 'axios'

const api = axios.create({
    baseURL: './',
    headers: {
        common: { 'X-Requested-With': 'XMLHttpRequest' },
        post: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    },
})

export default api
