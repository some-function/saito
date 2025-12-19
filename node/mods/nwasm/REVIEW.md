# NWasm Module Review

## Overview
The NWasm module is a Nintendo 64 emulator that allows users to play legally-owned ROMs in their browser. It integrates with the Saito blockchain network for ROM storage, encryption, and library management.

## Architecture

### Core Components
1. **Main Module** (`nwasm.js`): Extends `OnePlayerGameTemplate`, handles ROM management, encryption, and library operations
2. **UI Components** (`lib/ui/main.js`): Library display and game selection interface
3. **ROM Management** (`lib/upload-rom.js`, `lib/load-rom.js`): Handles ROM upload and loading
4. **Save Games** (`lib/save-games.js`): Manages game save states
5. **Web Interface** (`web/`): Frontend emulator interface using WebAssembly

### Key Features
- **ROM Encryption**: XOR-based encryption for ROM files stored in transactions
- **Library Management**: Tracks ROMs by public key, supports local and peer libraries
- **Save State Management**: Saves game states to transactions indexed by ROM signature
- **NFT Integration**: Supports NFT-protected ROMs via Vault module
- **Peer-to-Peer**: Can query peers for available ROMs in their libraries

## Critical Issues Found

### 1. **Bug in `loadGameFile()` - Line 879**
**Location**: `nwasm.js:879`
**Issue**: Typo - `mwasm_mod` should be `nwasm_mod`
```javascript
mwasm_mod.active_game_time_played = txmsg.time_played;  // ❌ Wrong
nwasm_mod.active_game_time_played = txmsg.time_played;  // ✅ Correct
```
**Impact**: This will cause a ReferenceError when trying to load a saved game file.

### 2. **Bug in `isItemInLibrary()` - Line 159**
**Location**: `nwasm.js:159`
**Issue**: Incorrect array access - `this.library[peer]` is an array, not an object
```javascript
if (item.id == this.library[peer].id) {  // ❌ Wrong - library[peer] is an array
```
**Should be**:
```javascript
if (item.id == this.library[peer][i].id) {  // ✅ Correct
```
**Impact**: This function will never correctly identify items in the library.

### 3. **Debug Code Left in Production**
**Location**: `lib/upload-rom.js:48-57`
**Issue**: Multiple debug console.log statements with base64 data dump
```javascript
console.log("!!!!!!!!");
console.log("!!!!!!!!");
// ... (9 times)
console.log(a);  // Dumps entire base64 ROM data
```
**Impact**: Performance issue, potential security concern (logging sensitive data), cluttered console

**Location**: `lib/ui/main.js:31`
**Issue**: Debug console.log dumping entire library
```javascript
console.log("LIBRARY: " + JSON.stringify(nwasm_self.library));
```
**Impact**: Performance issue, potential security concern (logging encryption keys)

**Location**: `lib/ui/main.js:153`
**Issue**: Debug console.log
```javascript
console.log('THEREIS AT LEAST 1 TX');
```

## Code Quality Issues

### 4. **Inconsistent Error Handling**
- Some functions have try-catch blocks, others don't
- Error messages are inconsistent (some use `alert()`, others use `console.log()`)
- Missing null checks in several places (e.g., `loadRomFile()` doesn't check if library exists before iterating)

### 5. **Unused/Empty Functions**
**Location**: `lib/load-rom.js:38`
```javascript
attachEvents() {}  // Empty function
```
**Note**: This appears to be a placeholder or incomplete implementation.

### 6. **Typo in Comment**
**Location**: `nwasm.js:29`
```javascript
// 	ROMS -- saved as 'Nwams' modules  // Should be 'Nwasm'
```

### 7. **Variable Naming Inconsistency**
**Location**: `nwasm.js:880`
```javascript
nwasm.startPlaying();  // Should be nwasm_mod.startPlaying()
```
**Note**: This works because `nwasm` is likely in scope, but inconsistent with the pattern used elsewhere.

### 8. **Missing Error Handling in Vault Integration**
**Location**: `nwasm.js:610-614`
```javascript
vault_mod.sendAccessFileRequest(vault_data, (base64) => {
    if (!base64) { console.log("ERROR: cannot load from Vault"); return; }
    // ...
});
```
**Issue**: Only logs error, doesn't notify user or handle gracefully.

## Security Considerations

### 9. **Weak Encryption**
**Location**: `nwasm.js:934-938`
**Issue**: Uses XOR encryption which is not cryptographically secure
```javascript
xorBase64(data, secret_key) {
    let b = Buffer.from(data, 'base64');
    let r = Buffer.from(secret_key, 'utf8');
    return xorInplace(b, r).toString('base64');
}
```
**Note**: This may be intentional for simplicity, but should be documented. For sensitive ROM data, consider AES encryption.

### 10. **Secret Keys Stored in Plaintext**
**Location**: `nwasm.js:47-61` (library structure)
**Issue**: Encryption keys are stored in plaintext in the library object, which is saved to `app.options.nwasm`
```javascript
this.library[peer] = [
    {
        id: "id",
        title: "title",
        key: "",  // Secret key stored in plaintext
        sig: "sig"
    }
]
```
**Recommendation**: Consider encrypting the keys themselves or using a key derivation function.

### 11. **Library Data Exposure**
**Location**: `nwasm.js:275-277`
**Issue**: When sharing library with peers, keys are removed but entire library structure is sent
```javascript
let x = JSON.parse(JSON.stringify(this.library[this.publicKey]));
for (let key in x) { x.random = ""; } // do not share decryption key
```
**Note**: The loop variable name `key` is misleading - it should be `item` or `index`. Also, this only removes one property per item, not all sensitive data.

## Architecture Observations

### Strengths
1. **Good Separation of Concerns**: Clear division between UI, ROM management, and core functionality
2. **Library Management**: Well-designed system for tracking ROMs across peers
3. **Transaction Integration**: Clever use of Saito transactions for ROM storage
4. **NFT Support**: Good integration with Vault module for NFT-protected content
5. **Save State Management**: Integrated save/load functionality with transaction storage

### Areas for Improvement
1. **Error Handling**: Standardize error handling patterns across the module
2. **Type Safety**: Add input validation and type checking
3. **Documentation**: Add JSDoc comments for public methods
4. **Testing**: No visible test files - consider adding unit tests
5. **Code Duplication**: Some repeated patterns (e.g., time formatting in save-games.js)

## Recommendations

### High Priority
1. **Fix Critical Bugs**: 
   - Fix `mwasm_mod` typo in `loadGameFile()`
   - Fix `isItemInLibrary()` array access bug
2. **Remove Debug Code**: Clean up all console.log debug statements
3. **Improve Error Handling**: Add consistent error handling and user feedback

### Medium Priority
4. **Security Review**: Consider stronger encryption for ROM files
5. **Code Cleanup**: Remove unused functions, fix typos, standardize naming
6. **Documentation**: Add inline documentation for complex functions

### Low Priority
7. **Refactoring**: Consider extracting common patterns into utility functions
8. **Testing**: Add unit tests for core functionality
9. **Performance**: Review console.log interception for performance impact

## Legal Compliance
The module includes appropriate legal disclaimers:
- Encourages use only with legally-owned ROMs
- Mentions legal lending/borrowing permissions
- References Saito Store for legal ROM sales

## Conclusion
The NWasm module is a well-architected emulator integration with good separation of concerns and innovative use of blockchain technology for ROM storage. However, there are several critical bugs that need immediate attention, and code quality improvements would enhance maintainability and security.

**Overall Assessment**: Good architecture with critical bugs that need fixing before production use.

