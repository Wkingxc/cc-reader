export default function App() {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <div className="w-72 bg-gray-800 border-r border-gray-700 p-4">
        Sidebar
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-12 bg-gray-800 border-b border-gray-700 px-4 flex items-center">
          Toolbar
        </div>
        <div className="flex-1 overflow-y-auto p-4">Messages</div>
      </div>
    </div>
  );
}
