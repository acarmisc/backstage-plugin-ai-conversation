import React, { useState, useEffect } from 'react';
import {
  Button,
  Box,
  Typography,
  CircularProgress,
  Tooltip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Chip,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/VpnKey';
import DeleteIcon from '@mui/icons-material/Delete';
import { useApi } from '@backstage/core-plugin-api';
import { liteLlmChatApiRef } from '../api';
import type { ChatKeySummary } from '../types';

export interface KeyPickerProps {
  value: { alias: string; token: string };
  onChange: (val: { alias: string; token: string }) => void;
  onDelete?: () => void;
}

export const KeyPicker: React.FC<KeyPickerProps> = ({ value, onChange, onDelete }) => {
  const chatApi = useApi(liteLlmChatApiRef);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'generate' | 'existing'>('idle');
  const [existingKeys, setExistingKeys] = useState<ChatKeySummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedAlias, setSelectedAlias] = useState('');
  const [pastedToken, setPastedToken] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const keyInfo = await chatApi.mintChatKey();
      onChange({ alias: keyInfo.key_alias, token: keyInfo.key });
      setMode('idle');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingKeys = async () => {
    setListLoading(true);
    setListError(null);
    try {
      const keys = await chatApi.listChatKeys();
      setExistingKeys(keys);
    } catch (err: any) {
      setListError(err.message);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'existing') {
      loadExistingKeys();
    }
  }, [mode]);

  const handleUseExisting = () => {
    if (!pastedToken.trim() || !selectedAlias) return;
    onChange({ alias: selectedAlias, token: pastedToken.trim() });
    setMode('idle');
    setSelectedAlias('');
    setPastedToken('');
  };

  const handleDelete = async () => {
    if (!value.token) return;
    try {
      await chatApi.deleteChatKey(value.token);
    } catch {
      // best-effort cleanup
    }
    onDelete?.();
    onChange({ alias: '', token: '' });
  };

  const formatExpiry = (expiresAt?: string) => {
    if (!expiresAt) return 'no expiry';
    const exp = new Date(expiresAt).getTime();
    if (Number.isNaN(exp)) return 'unknown';
    const hours = Math.round((exp - Date.now()) / 3_600_000);
    if (hours <= 0) return 'expired';
    if (hours < 24) return `${hours}h left`;
    return `${Math.round(hours / 24)}d left`;
  };

  if (value.token) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
        <KeyIcon fontSize="small" color="success" />
        <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value.alias || 'chat key'}
        </Typography>
        <Tooltip title="Delete chat key">
          <IconButton edge="end" size="small" onClick={handleDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ minWidth: 200, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {mode === 'idle' && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <KeyIcon />}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? 'Minting…' : 'Generate new key'}
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => setMode('existing')}
          >
            Use existing key
          </Button>
        </Box>
      )}

      {mode === 'existing' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
              Use existing key
            </Typography>
            <Button size="small" onClick={() => setMode('idle')} sx={{ minWidth: 'auto' }}>
              Back
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Keys are stored hashed — paste the sk- token you saved when the key was created.
          </Typography>
          {listLoading && <CircularProgress size={16} />}
          {listError && (
            <Typography variant="caption" color="error">
              {listError}
            </Typography>
          )}
          {!listLoading && !listError && existingKeys.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No non-expired chat keys found. Generate a new one instead.
            </Typography>
          )}
          {existingKeys.length > 0 && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Select key</InputLabel>
                <Select
                  value={selectedAlias}
                  label="Select key"
                  onChange={e => setSelectedAlias(e.target.value)}
                >
                  {existingKeys.map(k => (
                    <MenuItem key={k.key_alias} value={k.key_alias}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {k.key_alias}
                        </Typography>
                        <Chip
                          size="small"
                          label={formatExpiry(k.expires_at)}
                          color={
                            k.expires_at && new Date(k.expires_at).getTime() < Date.now()
                              ? 'error'
                              : 'default'
                          }
                          variant="outlined"
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                fullWidth
                label="Paste sk- token"
                placeholder="sk-..."
                value={pastedToken}
                onChange={e => setPastedToken(e.target.value)}
                type="password"
              />
              <Button
                size="small"
                variant="contained"
                onClick={handleUseExisting}
                disabled={!pastedToken.trim() || !selectedAlias}
              >
                Use this key
              </Button>
            </>
          )}
        </Box>
      )}

      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Box>
  );
};