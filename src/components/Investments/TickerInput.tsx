import { useEffect, useRef, useState } from "react";
import { searchStocks, type StockSuggestion } from "../../api";

const DEBOUNCE_MS = 300;

type TickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  onPick: (suggestion: StockSuggestion) => void;
  style?: React.CSSProperties;
};

// Text box that suggests tickers (by company name or symbol) as you type
const TickerInput: React.FC<TickerInputProps> = ({
  value,
  onChange,
  onPick,
  style,
}) => {
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  // Set after picking so the chosen symbol doesn't trigger another search
  const skipSearch = useRef(false);

  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      searchStocks(value)
        .then((s) => {
          if (stale) return;
          setSuggestions(s);
          setOpen(true);
        })
        .catch(() => !stale && setSuggestions([]));
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <div style={{ position: "relative", flex: 1, minWidth: "190px" }}>
      <input
        placeholder="Search ticker or company"
        title="Type a company name or symbol, then pick a suggestion"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        autoComplete="off"
        style={{ ...style, width: "100%" }}
      />
      {open && suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 10,
            margin: 0,
            padding: 0,
            listStyle: "none",
            maxHeight: "260px",
            overflowY: "auto",
            border: "1px solid rgb(205, 201, 200)",
            borderRadius: "5px",
            backgroundColor: "rgb(40, 39, 39)",
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s.symbol}
              // mousedown fires before the input's blur, which would close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                skipSearch.current = true;
                onPick(s);
                setOpen(false);
              }}
              style={{ padding: "8px 10px", cursor: "pointer" }}
            >
              <strong>{s.symbol}</strong>
              <small style={{ display: "block" }}>
                {s.name}
                {s.exchange && ` · ${s.exchange}`}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TickerInput;
