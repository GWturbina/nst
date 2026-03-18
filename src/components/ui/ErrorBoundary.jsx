'use client'
import { Component } from 'react'

/**
 * FIX M8: Error Boundary — ловит ошибки React компонентов
 * Вместо белого экрана показывает сообщение + кнопку перезагрузки
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '2rem',
          background: '#1a1a2e', color: '#fff', textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Что-то пошло не так
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1.5rem', maxWidth: '300px' }}>
            Произошла ошибка. Попробуйте перезагрузить страницу.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{
              padding: '0.75rem 2rem', borderRadius: '1rem', border: '1px solid rgba(255,215,0,0.3)',
              background: 'rgba(255,215,0,0.1)', color: '#ffd700', fontWeight: 'bold',
              cursor: 'pointer', fontSize: '0.9rem',
            }}>
            🔄 Перезагрузить
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
