import { Calculator } from "./components/Calculator";
import { ErrorBoundary } from "./ErrorBoundary";

function App() {
  return (
    <main className="app">
      <h1>Calculator</h1>
      <ErrorBoundary>
        <Calculator />
      </ErrorBoundary>
    </main>
  );
}

export default App;
