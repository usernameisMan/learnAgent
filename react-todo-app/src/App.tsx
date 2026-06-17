import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Todo {
  id: number
  text: string
  completed: boolean
  createdAt: number
}

type FilterType = 'all' | 'active' | 'completed'

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('todos')
    return saved ? JSON.parse(saved) : []
  })
  const [inputValue, setInputValue] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set())
  const [addingId, setAddingId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingId])

  const addTodo = () => {
    const text = inputValue.trim()
    if (!text) return

    const newTodo: Todo = {
      id: Date.now(),
      text,
      completed: false,
      createdAt: Date.now()
    }

    setAddingId(newTodo.id)
    setTodos([...todos, newTodo])
    setInputValue('')
    inputRef.current?.focus()

    setTimeout(() => setAddingId(null), 400)
  }

  const deleteTodo = (id: number) => {
    setRemovingIds(new Set([id]))
    setTimeout(() => {
      setTodos(todos.filter(todo => todo.id !== id))
      setRemovingIds(new Set())
    }, 300)
  }

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id)
    setEditingText(todo.text)
  }

  const saveEdit = () => {
    if (editingId === null) return
    const text = editingText.trim()
    if (!text) {
      deleteTodo(editingId)
    } else {
      setTodos(todos.map(todo =>
        todo.id === editingId ? { ...todo, text } : todo
      ))
    }
    setEditingId(null)
    setEditingText('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingText('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTodo()
    }
  }

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  const clearCompleted = () => {
    const completedIds = todos.filter(t => t.completed).map(t => t.id)
    setRemovingIds(new Set(completedIds))
    setTimeout(() => {
      setTodos(todos.filter(todo => !todo.completed))
      setRemovingIds(new Set())
    }, 300)
  }

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  const totalCount = todos.length
  const activeCount = todos.filter(t => !t.completed).length
  const completedCount = todos.filter(t => t.completed).length

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>📝 Todo List</h1>
          <p className="subtitle">高效管理你的每一天</p>
        </header>

        <div className="input-section">
          <input
            ref={inputRef}
            type="text"
            className="todo-input"
            placeholder="添加新任务..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
          />
          <button className="add-btn" onClick={addTodo} disabled={!inputValue.trim()}>
            添加
          </button>
        </div>

        <div className="stats-bar">
          <div className="stats">
            <span className="stat-item">
              <span className="stat-number">{totalCount}</span> 全部
            </span>
            <span className="stat-item active">
              <span className="stat-number">{activeCount}</span> 进行中
            </span>
            <span className="stat-item completed">
              <span className="stat-number">{completedCount}</span> 已完成
            </span>
          </div>
          {completedCount > 0 && (
            <button className="clear-btn" onClick={clearCompleted}>
              清除已完成
            </button>
          )}
        </div>

        <div className="filter-tabs">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            进行中
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            已完成
          </button>
        </div>

        <ul className="todo-list">
          {filteredTodos.length === 0 && (
            <li className="empty-state">
              {totalCount === 0 ? '🎉 开始添加你的第一个任务吧！' : '🔍 没有匹配的任务'}
            </li>
          )}
          {filteredTodos.map(todo => (
            <li
              key={todo.id}
              className={`todo-item ${todo.completed ? 'completed' : ''} ${removingIds.has(todo.id) ? 'removing' : ''} ${addingId === todo.id ? 'adding' : ''}`}
            >
              <div className="todo-content">
                <input
                  type="checkbox"
                  className="todo-checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                />
                {editingId === todo.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    className="edit-input"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleEditKeyPress}
                  />
                ) : (
                  <span
                    className="todo-text"
                    onDoubleClick={() => startEditing(todo)}
                  >
                    {todo.text}
                  </span>
                )}
              </div>
              <div className="todo-actions">
                {editingId !== todo.id && (
                  <>
                    <button
                      className="edit-btn"
                      onClick={() => startEditing(todo)}
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => deleteTodo(todo.id)}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        <footer className="footer">
          <p>💡 双击任务可编辑 | 数据自动保存到本地</p>
        </footer>
      </div>
    </div>
  )
}

export default App
