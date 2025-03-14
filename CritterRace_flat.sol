// Sources flattened with hardhat v2.22.19 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.4) (utils/Context.sol)

pragma solidity ^0.8.0;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/security/Pausable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.7.0) (security/Pausable.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract Pausable is Context {
    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    bool private _paused;

    /**
     * @dev Initializes the contract in unpaused state.
     */
    constructor() {
        _paused = false;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        require(!paused(), "Pausable: paused");
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        require(paused(), "Pausable: not paused");
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}


// File @openzeppelin/contracts/utils/introspection/IERC165.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (utils/introspection/IERC165.sol)

pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[EIP].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File @openzeppelin/contracts/token/ERC721/IERC721.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC721/IERC721.sol)

pragma solidity ^0.8.0;

/**
 * @dev Required interface of an ERC721 compliant contract.
 */
interface IERC721 is IERC165 {
    /**
     * @dev Emitted when `tokenId` token is transferred from `from` to `to`.
     */
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    /**
     * @dev Emitted when `owner` enables `approved` to manage the `tokenId` token.
     */
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    /**
     * @dev Emitted when `owner` enables or disables (`approved`) `operator` to manage all of its assets.
     */
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    /**
     * @dev Returns the number of tokens in ``owner``'s account.
     */
    function balanceOf(address owner) external view returns (uint256 balance);

    /**
     * @dev Returns the owner of the `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
     * are aware of the ERC721 protocol to prevent tokens from being forever locked.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If the caller is not `from`, it must have been allowed to move this token by either {approve} or {setApprovalForAll}.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) external;

    /**
     * @dev Transfers `tokenId` token from `from` to `to`.
     *
     * WARNING: Note that the caller is responsible to confirm that the recipient is capable of receiving ERC721
     * or else they may be permanently lost. Usage of {safeTransferFrom} prevents loss, though the caller must
     * understand this adds an external call which potentially creates a reentrancy vulnerability.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     * - If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 tokenId) external;

    /**
     * @dev Gives permission to `to` to transfer `tokenId` token to another account.
     * The approval is cleared when the token is transferred.
     *
     * Only a single account can be approved at a time, so approving the zero address clears previous approvals.
     *
     * Requirements:
     *
     * - The caller must own the token or be an approved operator.
     * - `tokenId` must exist.
     *
     * Emits an {Approval} event.
     */
    function approve(address to, uint256 tokenId) external;

    /**
     * @dev Approve or remove `operator` as an operator for the caller.
     * Operators can call {transferFrom} or {safeTransferFrom} for any token owned by the caller.
     *
     * Requirements:
     *
     * - The `operator` cannot be the caller.
     *
     * Emits an {ApprovalForAll} event.
     */
    function setApprovalForAll(address operator, bool approved) external;

    /**
     * @dev Returns the account approved for `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function getApproved(uint256 tokenId) external view returns (address operator);

    /**
     * @dev Returns if the `operator` is allowed to manage all of the assets of `owner`.
     *
     * See {setApprovalForAll}
     */
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}


// File @openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC721/extensions/IERC721Metadata.sol)

pragma solidity ^0.8.0;

/**
 * @title ERC-721 Non-Fungible Token Standard, optional metadata extension
 * @dev See https://eips.ethereum.org/EIPS/eip-721
 */
interface IERC721Metadata is IERC721 {
    /**
     * @dev Returns the token collection name.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the token collection symbol.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the Uniform Resource Identifier (URI) for `tokenId` token.
     */
    function tokenURI(uint256 tokenId) external view returns (string memory);
}


// File @openzeppelin/contracts/token/ERC721/IERC721Receiver.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC721/IERC721Receiver.sol)

pragma solidity ^0.8.0;

/**
 * @title ERC721 token receiver interface
 * @dev Interface for any contract that wants to support safeTransfers
 * from ERC721 asset contracts.
 */
interface IERC721Receiver {
    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}


// File @openzeppelin/contracts/utils/Address.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (utils/Address.sol)

pragma solidity ^0.8.1;

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     *
     * Furthermore, `isContract` will also return true if the target contract within
     * the same transaction is already scheduled for destruction by `SELFDESTRUCT`,
     * which only has an effect at the end of a transaction.
     * ====
     *
     * [IMPORTANT]
     * ====
     * You shouldn't rely on `isContract` to protect against flash loan attacks!
     *
     * Preventing calls from contracts is highly discouraged. It breaks composability, breaks support for smart wallets
     * like Gnosis Safe, and does not provide security since it can be circumvented by calling from a contract
     * constructor.
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize/address.code.length, which returns 0
        // for contracts in construction, since the code is only stored at the end
        // of the constructor execution.

        return account.code.length > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.0/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and revert (either by bubbling
     * the revert reason or using the provided one) in case of unsuccessful call or if target was not a contract.
     *
     * _Available since v4.8._
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        if (success) {
            if (returndata.length == 0) {
                // only check isContract if the call was successful and the return data is empty
                // otherwise we already know that it was a contract
                require(isContract(target), "Address: call to non-contract");
            }
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and revert if it wasn't, either by bubbling the
     * revert reason or using the provided one.
     *
     * _Available since v4.3._
     */
    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    function _revert(bytes memory returndata, string memory errorMessage) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            /// @solidity memory-safe-assembly
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert(errorMessage);
        }
    }
}


// File @openzeppelin/contracts/utils/introspection/ERC165.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (utils/introspection/ERC165.sol)

pragma solidity ^0.8.0;

/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts that want to implement ERC165 should inherit from this contract and override {supportsInterface} to check
 * for the additional interface id that will be supported. For example:
 *
 * ```solidity
 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
 * }
 * ```
 *
 * Alternatively, {ERC165Storage} provides an easier to use but more expensive implementation.
 */
abstract contract ERC165 is IERC165 {
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}


// File @openzeppelin/contracts/utils/math/Math.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (utils/math/Math.sol)

pragma solidity ^0.8.0;

/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math {
    enum Rounding {
        Down, // Toward negative infinity
        Up, // Toward infinity
        Zero // Toward zero
    }

    /**
     * @dev Returns the largest of two numbers.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @dev Returns the average of two numbers. The result is rounded towards
     * zero.
     */
    function average(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b) / 2 can overflow.
        return (a & b) + (a ^ b) / 2;
    }

    /**
     * @dev Returns the ceiling of the division of two numbers.
     *
     * This differs from standard division with `/` in that it rounds up instead
     * of rounding down.
     */
    function ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b - 1) / b can overflow on addition, so we distribute.
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    /**
     * @notice Calculates floor(x * y / denominator) with full precision. Throws if result overflows a uint256 or denominator == 0
     * @dev Original credit to Remco Bloemen under MIT license (https://xn--2-umb.com/21/muldiv)
     * with further edits by Uniswap Labs also under MIT license.
     */
    function mulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        unchecked {
            // 512-bit multiply [prod1 prod0] = x * y. Compute the product mod 2^256 and mod 2^256 - 1, then use
            // use the Chinese Remainder Theorem to reconstruct the 512 bit result. The result is stored in two 256
            // variables such that product = prod1 * 2^256 + prod0.
            uint256 prod0; // Least significant 256 bits of the product
            uint256 prod1; // Most significant 256 bits of the product
            assembly {
                let mm := mulmod(x, y, not(0))
                prod0 := mul(x, y)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }

            // Handle non-overflow cases, 256 by 256 division.
            if (prod1 == 0) {
                // Solidity will revert if denominator == 0, unlike the div opcode on its own.
                // The surrounding unchecked block does not change this fact.
                // See https://docs.soliditylang.org/en/latest/control-structures.html#checked-or-unchecked-arithmetic.
                return prod0 / denominator;
            }

            // Make sure the result is less than 2^256. Also prevents denominator == 0.
            require(denominator > prod1, "Math: mulDiv overflow");

            ///////////////////////////////////////////////
            // 512 by 256 division.
            ///////////////////////////////////////////////

            // Make division exact by subtracting the remainder from [prod1 prod0].
            uint256 remainder;
            assembly {
                // Compute remainder using mulmod.
                remainder := mulmod(x, y, denominator)

                // Subtract 256 bit number from 512 bit number.
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }

            // Factor powers of two out of denominator and compute largest power of two divisor of denominator. Always >= 1.
            // See https://cs.stackexchange.com/q/138556/92363.

            // Does not overflow because the denominator cannot be zero at this stage in the function.
            uint256 twos = denominator & (~denominator + 1);
            assembly {
                // Divide denominator by twos.
                denominator := div(denominator, twos)

                // Divide [prod1 prod0] by twos.
                prod0 := div(prod0, twos)

                // Flip twos such that it is 2^256 / twos. If twos is zero, then it becomes one.
                twos := add(div(sub(0, twos), twos), 1)
            }

            // Shift in bits from prod1 into prod0.
            prod0 |= prod1 * twos;

            // Invert denominator mod 2^256. Now that denominator is an odd number, it has an inverse modulo 2^256 such
            // that denominator * inv = 1 mod 2^256. Compute the inverse by starting with a seed that is correct for
            // four bits. That is, denominator * inv = 1 mod 2^4.
            uint256 inverse = (3 * denominator) ^ 2;

            // Use the Newton-Raphson iteration to improve the precision. Thanks to Hensel's lifting lemma, this also works
            // in modular arithmetic, doubling the correct bits in each step.
            inverse *= 2 - denominator * inverse; // inverse mod 2^8
            inverse *= 2 - denominator * inverse; // inverse mod 2^16
            inverse *= 2 - denominator * inverse; // inverse mod 2^32
            inverse *= 2 - denominator * inverse; // inverse mod 2^64
            inverse *= 2 - denominator * inverse; // inverse mod 2^128
            inverse *= 2 - denominator * inverse; // inverse mod 2^256

            // Because the division is now exact we can divide by multiplying with the modular inverse of denominator.
            // This will give us the correct result modulo 2^256. Since the preconditions guarantee that the outcome is
            // less than 2^256, this is the final result. We don't need to compute the high bits of the result and prod1
            // is no longer required.
            result = prod0 * inverse;
            return result;
        }
    }

    /**
     * @notice Calculates x * y / denominator with full precision, following the selected rounding direction.
     */
    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding) internal pure returns (uint256) {
        uint256 result = mulDiv(x, y, denominator);
        if (rounding == Rounding.Up && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
        return result;
    }

    /**
     * @dev Returns the square root of a number. If the number is not a perfect square, the value is rounded down.
     *
     * Inspired by Henry S. Warren, Jr.'s "Hacker's Delight" (Chapter 11).
     */
    function sqrt(uint256 a) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        // For our first guess, we get the biggest power of 2 which is smaller than the square root of the target.
        //
        // We know that the "msb" (most significant bit) of our target number `a` is a power of 2 such that we have
        // `msb(a) <= a < 2*msb(a)`. This value can be written `msb(a)=2**k` with `k=log2(a)`.
        //
        // This can be rewritten `2**log2(a) <= a < 2**(log2(a) + 1)`
        // → `sqrt(2**k) <= sqrt(a) < sqrt(2**(k+1))`
        // → `2**(k/2) <= sqrt(a) < 2**((k+1)/2) <= 2**(k/2 + 1)`
        //
        // Consequently, `2**(log2(a) / 2)` is a good first approximation of `sqrt(a)` with at least 1 correct bit.
        uint256 result = 1 << (log2(a) >> 1);

        // At this point `result` is an estimation with one bit of precision. We know the true value is a uint128,
        // since it is the square root of a uint256. Newton's method converges quadratically (precision doubles at
        // every iteration). We thus need at most 7 iteration to turn our partial result with one bit of precision
        // into the expected uint128 result.
        unchecked {
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            return min(result, a / result);
        }
    }

    /**
     * @notice Calculates sqrt(a), following the selected rounding direction.
     */
    function sqrt(uint256 a, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = sqrt(a);
            return result + (rounding == Rounding.Up && result * result < a ? 1 : 0);
        }
    }

    /**
     * @dev Return the log in base 2, rounded down, of a positive value.
     * Returns 0 if given 0.
     */
    function log2(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >> 128 > 0) {
                value >>= 128;
                result += 128;
            }
            if (value >> 64 > 0) {
                value >>= 64;
                result += 64;
            }
            if (value >> 32 > 0) {
                value >>= 32;
                result += 32;
            }
            if (value >> 16 > 0) {
                value >>= 16;
                result += 16;
            }
            if (value >> 8 > 0) {
                value >>= 8;
                result += 8;
            }
            if (value >> 4 > 0) {
                value >>= 4;
                result += 4;
            }
            if (value >> 2 > 0) {
                value >>= 2;
                result += 2;
            }
            if (value >> 1 > 0) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 2, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log2(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log2(value);
            return result + (rounding == Rounding.Up && 1 << result < value ? 1 : 0);
        }
    }

    /**
     * @dev Return the log in base 10, rounded down, of a positive value.
     * Returns 0 if given 0.
     */
    function log10(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >= 10 ** 64) {
                value /= 10 ** 64;
                result += 64;
            }
            if (value >= 10 ** 32) {
                value /= 10 ** 32;
                result += 32;
            }
            if (value >= 10 ** 16) {
                value /= 10 ** 16;
                result += 16;
            }
            if (value >= 10 ** 8) {
                value /= 10 ** 8;
                result += 8;
            }
            if (value >= 10 ** 4) {
                value /= 10 ** 4;
                result += 4;
            }
            if (value >= 10 ** 2) {
                value /= 10 ** 2;
                result += 2;
            }
            if (value >= 10 ** 1) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 10, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log10(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log10(value);
            return result + (rounding == Rounding.Up && 10 ** result < value ? 1 : 0);
        }
    }

    /**
     * @dev Return the log in base 256, rounded down, of a positive value.
     * Returns 0 if given 0.
     *
     * Adding one to the result gives the number of pairs of hex symbols needed to represent `value` as a hex string.
     */
    function log256(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >> 128 > 0) {
                value >>= 128;
                result += 16;
            }
            if (value >> 64 > 0) {
                value >>= 64;
                result += 8;
            }
            if (value >> 32 > 0) {
                value >>= 32;
                result += 4;
            }
            if (value >> 16 > 0) {
                value >>= 16;
                result += 2;
            }
            if (value >> 8 > 0) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 256, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log256(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log256(value);
            return result + (rounding == Rounding.Up && 1 << (result << 3) < value ? 1 : 0);
        }
    }
}


// File @openzeppelin/contracts/utils/math/SignedMath.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (utils/math/SignedMath.sol)

pragma solidity ^0.8.0;

/**
 * @dev Standard signed math utilities missing in the Solidity language.
 */
library SignedMath {
    /**
     * @dev Returns the largest of two signed numbers.
     */
    function max(int256 a, int256 b) internal pure returns (int256) {
        return a > b ? a : b;
    }

    /**
     * @dev Returns the smallest of two signed numbers.
     */
    function min(int256 a, int256 b) internal pure returns (int256) {
        return a < b ? a : b;
    }

    /**
     * @dev Returns the average of two signed numbers without overflow.
     * The result is rounded towards zero.
     */
    function average(int256 a, int256 b) internal pure returns (int256) {
        // Formula from the book "Hacker's Delight"
        int256 x = (a & b) + ((a ^ b) >> 1);
        return x + (int256(uint256(x) >> 255) & (a ^ b));
    }

    /**
     * @dev Returns the absolute unsigned value of a signed value.
     */
    function abs(int256 n) internal pure returns (uint256) {
        unchecked {
            // must be unchecked in order to support `n = type(int256).min`
            return uint256(n >= 0 ? n : -n);
        }
    }
}


// File @openzeppelin/contracts/utils/Strings.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (utils/Strings.sol)

pragma solidity ^0.8.0;


/**
 * @dev String operations.
 */
library Strings {
    bytes16 private constant _SYMBOLS = "0123456789abcdef";
    uint8 private constant _ADDRESS_LENGTH = 20;

    /**
     * @dev Converts a `uint256` to its ASCII `string` decimal representation.
     */
    function toString(uint256 value) internal pure returns (string memory) {
        unchecked {
            uint256 length = Math.log10(value) + 1;
            string memory buffer = new string(length);
            uint256 ptr;
            /// @solidity memory-safe-assembly
            assembly {
                ptr := add(buffer, add(32, length))
            }
            while (true) {
                ptr--;
                /// @solidity memory-safe-assembly
                assembly {
                    mstore8(ptr, byte(mod(value, 10), _SYMBOLS))
                }
                value /= 10;
                if (value == 0) break;
            }
            return buffer;
        }
    }

    /**
     * @dev Converts a `int256` to its ASCII `string` decimal representation.
     */
    function toString(int256 value) internal pure returns (string memory) {
        return string(abi.encodePacked(value < 0 ? "-" : "", toString(SignedMath.abs(value))));
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation.
     */
    function toHexString(uint256 value) internal pure returns (string memory) {
        unchecked {
            return toHexString(value, Math.log256(value) + 1);
        }
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation with fixed length.
     */
    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }

    /**
     * @dev Converts an `address` with fixed length of 20 bytes to its not checksummed ASCII `string` hexadecimal representation.
     */
    function toHexString(address addr) internal pure returns (string memory) {
        return toHexString(uint256(uint160(addr)), _ADDRESS_LENGTH);
    }

    /**
     * @dev Returns true if the two strings are equal.
     */
    function equal(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}


// File @openzeppelin/contracts/token/ERC721/ERC721.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC721/ERC721.sol)

pragma solidity ^0.8.0;







/**
 * @dev Implementation of https://eips.ethereum.org/EIPS/eip-721[ERC721] Non-Fungible Token Standard, including
 * the Metadata extension, but not including the Enumerable extension, which is available separately as
 * {ERC721Enumerable}.
 */
contract ERC721 is Context, ERC165, IERC721, IERC721Metadata {
    using Address for address;
    using Strings for uint256;

    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    // Mapping from token ID to owner address
    mapping(uint256 => address) private _owners;

    // Mapping owner address to token count
    mapping(address => uint256) private _balances;

    // Mapping from token ID to approved address
    mapping(uint256 => address) private _tokenApprovals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC721-balanceOf}.
     */
    function balanceOf(address owner) public view virtual override returns (uint256) {
        require(owner != address(0), "ERC721: address zero is not a valid owner");
        return _balances[owner];
    }

    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = _ownerOf(tokenId);
        require(owner != address(0), "ERC721: invalid token ID");
        return owner;
    }

    /**
     * @dev See {IERC721Metadata-name}.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev See {IERC721Metadata-symbol}.
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overridden in child contracts.
     */
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    /**
     * @dev See {IERC721-approve}.
     */
    function approve(address to, uint256 tokenId) public virtual override {
        address owner = ERC721.ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");

        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "ERC721: approve caller is not token owner or approved for all"
        );

        _approve(to, tokenId);
    }

    /**
     * @dev See {IERC721-getApproved}.
     */
    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        _requireMinted(tokenId);

        return _tokenApprovals[tokenId];
    }

    /**
     * @dev See {IERC721-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public virtual override {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @dev See {IERC721-isApprovedForAll}.
     */
    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: caller is not token owner or approved");

        _transfer(from, to, tokenId);
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: caller is not token owner or approved");
        _safeTransfer(from, to, tokenId, data);
    }

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
     * are aware of the ERC721 protocol to prevent tokens from being forever locked.
     *
     * `data` is additional data, it has no specified format and it is sent in call to `to`.
     *
     * This internal function is equivalent to {safeTransferFrom}, and can be used to e.g.
     * implement alternative mechanisms to perform token transfer, such as signature-based.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory data) internal virtual {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, data), "ERC721: transfer to non ERC721Receiver implementer");
    }

    /**
     * @dev Returns the owner of the `tokenId`. Does NOT revert if token doesn't exist
     */
    function _ownerOf(uint256 tokenId) internal view virtual returns (address) {
        return _owners[tokenId];
    }

    /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
     *
     * Tokens start existing when they are minted (`_mint`),
     * and stop existing when they are burned (`_burn`).
     */
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /**
     * @dev Returns whether `spender` is allowed to manage `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        address owner = ERC721.ownerOf(tokenId);
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    /**
     * @dev Safely mints `tokenId` and transfers it to `to`.
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function _safeMint(address to, uint256 tokenId) internal virtual {
        _safeMint(to, tokenId, "");
    }

    /**
     * @dev Same as {xref-ERC721-_safeMint-address-uint256-}[`_safeMint`], with an additional `data` parameter which is
     * forwarded in {IERC721Receiver-onERC721Received} to contract recipients.
     */
    function _safeMint(address to, uint256 tokenId, bytes memory data) internal virtual {
        _mint(to, tokenId);
        require(
            _checkOnERC721Received(address(0), to, tokenId, data),
            "ERC721: transfer to non ERC721Receiver implementer"
        );
    }

    /**
     * @dev Mints `tokenId` and transfers it to `to`.
     *
     * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - `to` cannot be the zero address.
     *
     * Emits a {Transfer} event.
     */
    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");

        _beforeTokenTransfer(address(0), to, tokenId, 1);

        // Check that tokenId was not minted by `_beforeTokenTransfer` hook
        require(!_exists(tokenId), "ERC721: token already minted");

        unchecked {
            // Will not overflow unless all 2**256 token ids are minted to the same owner.
            // Given that tokens are minted one by one, it is impossible in practice that
            // this ever happens. Might change if we allow batch minting.
            // The ERC fails to describe this case.
            _balances[to] += 1;
        }

        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);

        _afterTokenTransfer(address(0), to, tokenId, 1);
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     * This is an internal function that does not check if the sender is authorized to operate on the token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function _burn(uint256 tokenId) internal virtual {
        address owner = ERC721.ownerOf(tokenId);

        _beforeTokenTransfer(owner, address(0), tokenId, 1);

        // Update ownership in case tokenId was transferred by `_beforeTokenTransfer` hook
        owner = ERC721.ownerOf(tokenId);

        // Clear approvals
        delete _tokenApprovals[tokenId];

        unchecked {
            // Cannot overflow, as that would require more tokens to be burned/transferred
            // out than the owner initially received through minting and transferring in.
            _balances[owner] -= 1;
        }
        delete _owners[tokenId];

        emit Transfer(owner, address(0), tokenId);

        _afterTokenTransfer(owner, address(0), tokenId, 1);
    }

    /**
     * @dev Transfers `tokenId` from `from` to `to`.
     *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     *
     * Emits a {Transfer} event.
     */
    function _transfer(address from, address to, uint256 tokenId) internal virtual {
        require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");
        require(to != address(0), "ERC721: transfer to the zero address");

        _beforeTokenTransfer(from, to, tokenId, 1);

        // Check that tokenId was not transferred by `_beforeTokenTransfer` hook
        require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");

        // Clear approvals from the previous owner
        delete _tokenApprovals[tokenId];

        unchecked {
            // `_balances[from]` cannot overflow for the same reason as described in `_burn`:
            // `from`'s balance is the number of token held, which is at least one before the current
            // transfer.
            // `_balances[to]` could overflow in the conditions described in `_mint`. That would require
            // all 2**256 token ids to be minted, which in practice is impossible.
            _balances[from] -= 1;
            _balances[to] += 1;
        }
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);

        _afterTokenTransfer(from, to, tokenId, 1);
    }

    /**
     * @dev Approve `to` to operate on `tokenId`
     *
     * Emits an {Approval} event.
     */
    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(ERC721.ownerOf(tokenId), to, tokenId);
    }

    /**
     * @dev Approve `operator` to operate on all of `owner` tokens
     *
     * Emits an {ApprovalForAll} event.
     */
    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
        require(owner != operator, "ERC721: approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    /**
     * @dev Reverts if the `tokenId` has not been minted yet.
     */
    function _requireMinted(uint256 tokenId) internal view virtual {
        require(_exists(tokenId), "ERC721: invalid token ID");
    }

    /**
     * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
     * The call is not executed if the target address is not a contract.
     *
     * @param from address representing the previous owner of the given token ID
     * @param to target address that will receive the tokens
     * @param tokenId uint256 ID of the token to be transferred
     * @param data bytes optional data to send along with the call
     * @return bool whether the call correctly returned the expected magic value
     */
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private returns (bool) {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    /// @solidity memory-safe-assembly
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    /**
     * @dev Hook that is called before any token transfer. This includes minting and burning. If {ERC721Consecutive} is
     * used, the hook may be called as part of a consecutive (batch) mint, as indicated by `batchSize` greater than 1.
     *
     * Calling conditions:
     *
     * - When `from` and `to` are both non-zero, ``from``'s tokens will be transferred to `to`.
     * - When `from` is zero, the tokens will be minted for `to`.
     * - When `to` is zero, ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     * - `batchSize` is non-zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal virtual {}

    /**
     * @dev Hook that is called after any token transfer. This includes minting and burning. If {ERC721Consecutive} is
     * used, the hook may be called as part of a consecutive (batch) mint, as indicated by `batchSize` greater than 1.
     *
     * Calling conditions:
     *
     * - When `from` and `to` are both non-zero, ``from``'s tokens were transferred to `to`.
     * - When `from` is zero, the tokens were minted for `to`.
     * - When `to` is zero, ``from``'s tokens were burned.
     * - `from` and `to` are never both zero.
     * - `batchSize` is non-zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _afterTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal virtual {}

    /**
     * @dev Unsafe write access to the balances, used by extensions that "mint" tokens using an {ownerOf} override.
     *
     * WARNING: Anyone calling this MUST ensure that the balances remain consistent with the ownership. The invariant
     * being that for any address `a` the value returned by `balanceOf(a)` must be equal to the number of tokens such
     * that `ownerOf(tokenId)` is `a`.
     */
    // solhint-disable-next-line func-name-mixedcase
    function __unsafe_increaseBalance(address account, uint256 amount) internal {
        _balances[account] += amount;
    }
}


// File @openzeppelin/contracts/utils/Base64.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.6) (utils/Base64.sol)

pragma solidity ^0.8.0;

/**
 * @dev Provides a set of functions to operate with Base64 strings.
 *
 * _Available since v4.5._
 */
library Base64 {
    /**
     * @dev Base64 Encoding/Decoding Table
     */
    string internal constant _TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    /**
     * @dev Converts a `bytes` to its Bytes64 `string` representation.
     */
    function encode(bytes memory data) internal pure returns (string memory) {
        /**
         * Inspired by Brecht Devos (Brechtpd) implementation - MIT licence
         * https://github.com/Brechtpd/base64/blob/e78d9fd951e7b0977ddca77d92dc85183770daf4/base64.sol
         */
        if (data.length == 0) return "";

        // Loads the table into memory
        string memory table = _TABLE;

        // Encoding takes 3 bytes chunks of binary data from `bytes` data parameter
        // and split into 4 numbers of 6 bits.
        // The final Base64 length should be `bytes` data length multiplied by 4/3 rounded up
        // - `data.length + 2`  -> Round up
        // - `/ 3`              -> Number of 3-bytes chunks
        // - `4 *`              -> 4 characters for each chunk
        string memory result = new string(4 * ((data.length + 2) / 3));

        /// @solidity memory-safe-assembly
        assembly {
            // Prepare the lookup table (skip the first "length" byte)
            let tablePtr := add(table, 1)

            // Prepare result pointer, jump over length
            let resultPtr := add(result, 0x20)
            let dataPtr := data
            let endPtr := add(data, mload(data))

            // In some cases, the last iteration will read bytes after the end of the data. We cache the value, and
            // set it to zero to make sure no dirty bytes are read in that section.
            let afterPtr := add(endPtr, 0x20)
            let afterCache := mload(afterPtr)
            mstore(afterPtr, 0x00)

            // Run over the input, 3 bytes at a time
            for {

            } lt(dataPtr, endPtr) {

            } {
                // Advance 3 bytes
                dataPtr := add(dataPtr, 3)
                let input := mload(dataPtr)

                // To write each character, shift the 3 byte (24 bits) chunk
                // 4 times in blocks of 6 bits for each character (18, 12, 6, 0)
                // and apply logical AND with 0x3F to bitmask the least significant 6 bits.
                // Use this as an index into the lookup table, mload an entire word
                // so the desired character is in the least significant byte, and
                // mstore8 this least significant byte into the result and continue.

                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
                resultPtr := add(resultPtr, 1) // Advance

                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
                resultPtr := add(resultPtr, 1) // Advance

                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))
                resultPtr := add(resultPtr, 1) // Advance

                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
                resultPtr := add(resultPtr, 1) // Advance
            }

            // Reset the value that was cached
            mstore(afterPtr, afterCache)

            // When data `bytes` is not exactly 3 bytes long
            // it is padded with `=` characters at the end
            switch mod(mload(data), 3)
            case 1 {
                mstore8(sub(resultPtr, 1), 0x3d)
                mstore8(sub(resultPtr, 2), 0x3d)
            }
            case 2 {
                mstore8(sub(resultPtr, 1), 0x3d)
            }
        }

        return result;
    }
}


// File contracts/MonadCritter.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;





contract MonadCritter is ERC721, Ownable, Pausable {
    using Strings for uint256;

    // All prices are in MON (Monad's native token)
    // 1 MON = 1e18 (18 decimals)
    uint256 public mintPrice = 0.01 * 1e18; // 0.01 MON
    uint256 public totalSupply;
    
    // Maximum mints per wallet
    uint256 public constant MAX_MINTS_PER_WALLET = 4;
    
    // Track mints per wallet
    mapping(address => uint256) public mintsPerWallet;

    // Base URI for sprites
    string public baseImageURI = "https://monadcritters.example.com/assets/sprites/";
    
    // Rarity names for metadata
    string[4] private rarityNames = ["Common", "Uncommon", "Rare", "Legendary"];
    
    // Sprite sizes for different display contexts
    uint256[5] private spriteSizes = [512, 256, 128, 64, 32];

    struct Stats {
        uint8 speed;
        uint8 stamina;
        uint8 luck;
        uint8 rarity; // 0: Common, 1: Uncommon, 2: Rare, 3: Legendary
    }

    mapping(uint256 => Stats) public tokenStats;

    event CritterMinted(uint256 indexed tokenId, address indexed owner, Stats stats);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event BaseImageURIUpdated(string oldURI, string newURI);

    constructor() ERC721("MonadCritter", "MCRIT") {
        _transferOwnership(msg.sender);
    }

    function mint() external payable whenNotPaused {
        require(msg.value >= mintPrice, "Insufficient MON sent");
        require(mintsPerWallet[msg.sender] < MAX_MINTS_PER_WALLET, "Exceeded max mints per wallet");

        uint256 tokenId = totalSupply + 1;
        Stats memory stats = generateStats();
        
        _safeMint(msg.sender, tokenId);
        tokenStats[tokenId] = stats;
        totalSupply++;
        mintsPerWallet[msg.sender]++;

        // Refund excess MON if any
        uint256 excess = msg.value - mintPrice;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "MON refund failed");
        }

        emit CritterMinted(tokenId, msg.sender, stats);
    }
    
    function ownerMint(address to, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        
        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = totalSupply + 1;
            Stats memory stats = generateStats();
            
            _safeMint(to, tokenId);
            tokenStats[tokenId] = stats;
            totalSupply++;
            
            emit CritterMinted(tokenId, to, stats);
        }
    }

    function generateStats() internal view returns (Stats memory) {
        // Use block data and token data for randomness
        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            totalSupply
        )));

        // Determine rarity (70/20/9/1 distribution)
        uint8 rarity;
        uint256 rarityRoll = rand % 100;
        if (rarityRoll < 70) rarity = 0; // Common
        else if (rarityRoll < 90) rarity = 1; // Uncommon
        else if (rarityRoll < 99) rarity = 2; // Rare
        else rarity = 3; // Legendary

        // Generate base stats (1-100)
        uint8 speed = uint8(((rand >> 8) % 60) + 40); // 40-100
        uint8 stamina = uint8(((rand >> 16) % 60) + 40); // 40-100
        uint8 luck = uint8(((rand >> 24) % 60) + 40); // 40-100

        // Apply rarity boosts
        if (rarity == 1) { // Uncommon: +10%
            uint256 boostedSpeed = uint256(speed) * 110 / 100;
            uint256 boostedStamina = uint256(stamina) * 110 / 100;
            uint256 boostedLuck = uint256(luck) * 110 / 100;
            speed = uint8(boostedSpeed > 255 ? 255 : boostedSpeed);
            stamina = uint8(boostedStamina > 255 ? 255 : boostedStamina);
            luck = uint8(boostedLuck > 255 ? 255 : boostedLuck);
        } else if (rarity == 2) { // Rare: +25%
            uint256 boostedSpeed = uint256(speed) * 125 / 100;
            uint256 boostedStamina = uint256(stamina) * 125 / 100;
            uint256 boostedLuck = uint256(luck) * 125 / 100;
            speed = uint8(boostedSpeed > 255 ? 255 : boostedSpeed);
            stamina = uint8(boostedStamina > 255 ? 255 : boostedStamina);
            luck = uint8(boostedLuck > 255 ? 255 : boostedLuck);
        } else if (rarity == 3) { // Legendary: +50%
            uint256 boostedSpeed = uint256(speed) * 150 / 100;
            uint256 boostedStamina = uint256(stamina) * 150 / 100;
            uint256 boostedLuck = uint256(luck) * 150 / 100;
            speed = uint8(boostedSpeed > 255 ? 255 : boostedSpeed);
            stamina = uint8(boostedStamina > 255 ? 255 : boostedStamina);
            luck = uint8(boostedLuck > 255 ? 255 : boostedLuck);
        }

        return Stats(speed, stamina, luck, rarity);
    }

    function getStats(uint256 tokenId) external view returns (Stats memory) {
        require(_exists(tokenId), "Token does not exist");
        return tokenStats[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        
        Stats memory stats = tokenStats[tokenId];
        
        // Build the JSON metadata in parts to reduce stack depth
        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(_buildTokenJSON(tokenId, stats))
            )
        );
    }
    
    function _buildTokenJSON(uint256 tokenId, Stats memory stats) internal view returns (bytes memory) {
        string memory rarityName = rarityNames[stats.rarity];
        string memory rarityLower = toLower(rarityName);
        
        // Part 1: Basic metadata
        bytes memory part1 = abi.encodePacked(
            '{"name": "MonadCritter #', tokenId.toString(), '",',
            '"description": "A ', rarityName, ' MonadCritter for racing on the Monad blockchain.",',
            '"attributes": [',
                '{"trait_type": "Rarity", "value": "', rarityName, '"},',
                '{"trait_type": "Speed", "value": ', uint256(stats.speed).toString(), '},',
                '{"trait_type": "Stamina", "value": ', uint256(stats.stamina).toString(), '},',
                '{"trait_type": "Luck", "value": ', uint256(stats.luck).toString(), '}',
            '],'
        );
        
        // Part 2: Image URLs
        bytes memory part2 = abi.encodePacked(
            '"image": "', baseImageURI, rarityLower, '-', spriteSizes[0].toString(), '.png",',
            '"image_512": "', baseImageURI, rarityLower, '-', spriteSizes[0].toString(), '.png",',
            '"image_256": "', baseImageURI, rarityLower, '-', spriteSizes[1].toString(), '.png",',
            '"image_128": "', baseImageURI, rarityLower, '-', spriteSizes[2].toString(), '.png",',
            '"image_64": "', baseImageURI, rarityLower, '-', spriteSizes[3].toString(), '.png",',
            '"image_32": "', baseImageURI, rarityLower, '-', spriteSizes[4].toString(), '.png"',
            '}'
        );
        
        return abi.encodePacked(part1, part2);
    }
    
    function toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        
        for (uint i = 0; i < bStr.length; i++) {
            // Convert uppercase to lowercase
            if (bStr[i] >= 0x41 && bStr[i] <= 0x5A) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        
        return string(bLower);
    }
    
    function setBaseImageURI(string memory _baseImageURI) external onlyOwner {
        string memory oldURI = baseImageURI;
        baseImageURI = _baseImageURI;
        emit BaseImageURIUpdated(oldURI, _baseImageURI);
    }

    function setMintPrice(uint256 _mintPrice) external onlyOwner {
        uint256 oldPrice = mintPrice;
        mintPrice = _mintPrice;
        emit MintPriceUpdated(oldPrice, _mintPrice);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No MON balance to withdraw");
        
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "MON transfer failed");
    }
}

interface IMonadCritter {
    struct Stats {
        uint256 speed;
        uint256 stamina;
        uint256 luck;
    }

    function getStats(uint256 tokenId) external view returns (Stats memory);
}


// File contracts/CritterRace.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;




contract CritterRace is Ownable, Pausable {
    MonadCritter public immutable critterContract; // Make immutable to save gas
    
    enum RaceSize { 
        None,  // 0
        Two,   // 1
        Five,  // 2
        Ten    // 3
    }
    
    // Packed struct to save gas (multiple values in same storage slot)
    struct RaceType {
        uint256 maxPlayers;
        uint256 numWinners;
        uint256 entryFee;
        bool isActive;
        uint256[] rewardPercentages;
    }
    
    mapping(RaceSize => RaceType) public raceTypes;
    
    // Constants using smaller uint types where possible
    uint256 public constant POWER_UP_PERCENT = 10; // Power-ups cost 10% of entry fee
    uint256 public devFeePercent = 0;

    // Packed struct for race data
    struct Race {
        uint256 id;              // Reduced from uint256 (supports up to 4 billion races)
        RaceSize raceSize;      // enum takes 1 byte
        uint256 playerCount;      // Track count separately to save gas on array length checks
        bool isActive;
        bool hasEnded;
        uint256 prizePool;       // Reduced from uint256 (still supports large amounts)
        uint256 startTime;       // Reduced from uint256 (supports dates until year 2106)
        address[] players;
        uint256[] critterIds;
        mapping(address => PowerUps) powerUps;
        RaceResult[] calculatedResults;  // Store pre-calculated results
    }

    // Packed struct for power-ups
    struct PowerUps {
        uint256 speedBoosts;     // Reduced from uint256 (max 255 boosts is plenty)
    }

    struct RaceResult {
        address player;
        uint256 critterId;      // Reduced from uint256
        uint256 finalPosition;    // Reduced from uint256
        uint256 reward;         // Reduced from uint256
        uint256 score;          // Reduced from uint256
    }

    mapping(uint256 => Race) public races;
    mapping(address => uint256) public playerInventory_SpeedBoost; // Reduced from uint256
    mapping(uint256 => mapping(address => bool)) public isParticipating;
    mapping(RaceSize => uint256[]) private activeRacesByType; // Track active races for each type
    
    uint256 public currentRaceId; // Reduced from uint256

    // Constants
    uint256 public constant BOOST_MULTIPLIER = 100;  // Reduced from uint256
    uint256 public constant MAX_BOOSTS_PER_RACE = 2;

    // Track revenue from power-up purchases
    uint256 public powerUpRevenue; // Reduced from uint256

    // Events with optimized parameter types
    event RaceCreated(uint256 indexed raceId);
    event PlayerJoined(uint256 indexed raceId, address indexed player, uint256 indexed critterId);
    event PowerUpLoaded(uint256 indexed raceId, address indexed player, bool isSpeedBoost, uint256 amount);
    event RaceStarted(uint256 indexed raceId, uint256 startTime);
    event PowerUpsPurchased(address indexed player, uint256 speedBoosts);
    event RaceTypeUpdated(RaceSize indexed raceSize, uint256 maxPlayers, uint256 numWinners, uint256 entryFee);
    event PowerUpRevenueWithdrawn(address indexed owner, uint256 amount);
    event RaceEnded(uint256 indexed raceId, RaceResult[] results);
    event AccidentalTokensWithdrawn(address indexed owner, uint256 amount);
    event DevFeeUpdated(uint256 oldFee, uint256 newFee);

    // Structs for stats and info
    struct CritterStats {
        uint8 speed;
        uint8 stamina;
        uint8 luck;
    }

    struct RaceScore {
        address player;
        uint256 critterId;
        uint256 score;
        uint256 position;
    }

    struct RaceTypeInfo {
        uint256 maxPlayers;
        uint256 numWinners;
        uint256 entryFee;
        uint256[] rewardPercentages;
        bool isActive;
    }

    struct RaceInfo {
        uint256 id;
        RaceSize raceSize;
        address[] players;
        uint256[] critterIds;
        uint256 startTime;
        bool isActive;
        bool hasEnded;
        uint256 prizePool;
    }

    // Add new mapping to track user race history
    mapping(address => uint256[]) private userRaceHistory;

    // Add PlayerStats struct after RaceResult struct
    struct PlayerStats {
        uint256 totalScore;
        uint256 racesParticipated;
        uint256 wins;        // First place finishes
        uint256 totalRewards;
        uint256 bestScore;
    }

    // Add mapping after other mappings
    mapping(address => PlayerStats) public playerStats;

    // Add RaceEndInfo struct after other structs
    struct RaceEndInfo {
        uint256 endTime;
        bool resultsCalculated;
        RaceResult[] results;
    }

    // Add mapping after other mappings
    mapping(uint256 => RaceEndInfo) public raceEndInfo;

    constructor(address _critterContract) {
        critterContract = MonadCritter(_critterContract);
        _transferOwnership(msg.sender);
        
        // Initialize race types more efficiently
        _initializeRaceTypes();
    }

    // Separate function to keep constructor gas cost lower
    function _initializeRaceTypes() private {
        // Two player race
        uint256[] memory twoPlayerRewards = new uint256[](1);
        twoPlayerRewards[0] = 100;
        raceTypes[RaceSize.Two] = RaceType({
            maxPlayers: 2,
            numWinners: 1,
            entryFee: 0.1 ether,
            rewardPercentages: twoPlayerRewards,
            isActive: true
        });
        
        // Five player race
        uint256[] memory fivePlayerRewards = new uint256[](2);
        fivePlayerRewards[0] = 70;
        fivePlayerRewards[1] = 30;
        raceTypes[RaceSize.Five] = RaceType({
            maxPlayers: 5,
            numWinners: 2,
            entryFee: 0.1 ether,
            rewardPercentages: fivePlayerRewards,
            isActive: true
        });
        
        // Ten player race
        uint256[] memory tenPlayerRewards = new uint256[](3);
        tenPlayerRewards[0] = 50;
        tenPlayerRewards[1] = 30;
        tenPlayerRewards[2] = 20;
        raceTypes[RaceSize.Ten] = RaceType({
            maxPlayers: 10,
            numWinners: 3,
            entryFee: 0.1 ether,
            rewardPercentages: tenPlayerRewards,
            isActive: true
        });
    }

    // Gas-optimized power-up purchase function
    function buyPowerUps(uint256 speedBoosts) external payable whenNotPaused {
        require(speedBoosts > 0, "Must buy at least 1 boost");
        
        // Calculate price based on 2 player race entry fee
        uint256 pricePerBoost;
        unchecked {
            pricePerBoost = (raceTypes[RaceSize.Two].entryFee * POWER_UP_PERCENT) / 100;
        }
        uint256 totalPrice = pricePerBoost * speedBoosts;
        require(msg.value == totalPrice, "Incorrect payment amount");
        
        unchecked {
            playerInventory_SpeedBoost[msg.sender] += speedBoosts;
            powerUpRevenue += msg.value;
        }
        
        emit PowerUpsPurchased(msg.sender, speedBoosts);
    }

    // Gas-optimized join race function
    function joinRace(
        uint256 raceId,
        uint256 raceTypeIndex,
        uint256 critterId,
        uint256 boost
    ) external payable whenNotPaused {
        Race storage race = races[raceId];
        require(race.id > 0, "Race does not exist");
        require(race.isActive && !race.hasEnded, "Race not available");
        
        RaceType storage raceConfig = raceTypes[RaceSize(raceTypeIndex)];
        require(race.playerCount < raceConfig.maxPlayers, "Race full");
        require(msg.value == raceConfig.entryFee, "Incorrect entry fee");
        require(boost <= MAX_BOOSTS_PER_RACE, "Max 2 boosts per race");
        require(playerInventory_SpeedBoost[msg.sender] >= boost, "Not enough boosts");
        require(!isParticipating[raceId][msg.sender], "Already in race");
        
        // Update state
        isParticipating[raceId][msg.sender] = true;
        race.players.push(msg.sender);
        race.critterIds.push(critterId);
        race.playerCount++;
        race.prizePool += msg.value;
        
        // Handle boosts if any
            if (boost > 0) {
                playerInventory_SpeedBoost[msg.sender] -= boost;
                race.powerUps[msg.sender].speedBoosts = boost;
                emit PowerUpLoaded(raceId, msg.sender, true, boost);
        }
        
        emit PlayerJoined(raceId, msg.sender, critterId);
    }

    // Internal function to start race
    function _startRace(uint256 raceId) private {
        Race storage race = races[raceId];
        race.startTime = block.timestamp;
        emit RaceStarted(raceId, race.startTime);
    }

    function setRaceType(
        RaceSize raceSize,
        uint256 maxPlayers,
        uint256 numWinners,
        uint256 entryFee,
        uint256[] calldata rewardPercentages,
        bool isActive
    ) external onlyOwner {
        require(maxPlayers > 1, "Min 2 players required");
        require(maxPlayers <= 20, "Max 20 players allowed");
        require(numWinners > 0 && numWinners <= maxPlayers, "Invalid number of winners");
        require(rewardPercentages.length == numWinners, "Reward percentages must match number of winners");
        
        uint256 total;
        for (uint256 i = 0; i < rewardPercentages.length; i++) {
            total += rewardPercentages[i];
        }
        require(total == 100, "Percentages must total 100");
        
        raceTypes[raceSize] = RaceType({
            maxPlayers: maxPlayers,
            numWinners: numWinners,
            entryFee: entryFee,
            rewardPercentages: rewardPercentages,
            isActive: isActive
        });
        
        emit RaceTypeUpdated(raceSize, maxPlayers, numWinners, entryFee);
    }

    function createRace(RaceSize raceSize) external whenNotPaused returns (uint256) {
        // Convert enum to player count
        uint256 playerCount;
        if (raceSize == RaceSize.Two) {
            playerCount = 2;
        } else if (raceSize == RaceSize.Five) {
            playerCount = 5;
        } else if (raceSize == RaceSize.Ten) {
            playerCount = 10;
        } else {
            revert("Invalid race size");
        }
        
        RaceType storage raceType = raceTypes[raceSize];
        require(raceType.isActive, "Race type not active");
        
        currentRaceId++;
        Race storage race = races[currentRaceId];
        race.id = currentRaceId;
        race.raceSize = raceSize;
        race.isActive = true;
        race.players = new address[](0);
        race.critterIds = new uint256[](0);
        
        activeRacesByType[raceSize].push(currentRaceId);
        
        emit RaceCreated(currentRaceId);
        return currentRaceId;
    }

    function cancelRace(uint256 raceId) external onlyOwner whenNotPaused {
        Race storage race = races[raceId];
        require(race.id > 0, "Race does not exist");
        require(race.isActive && !race.hasEnded, "Race not available for cancellation");
        
        race.isActive = false;
        race.hasEnded = true;
        
        // Refund entry fees to all players
        for (uint256 i = 0; i < race.players.length; i++) {
            address player = race.players[i];
            
            // Refund power-ups to player inventory
            PowerUps memory playerPowerUps = race.powerUps[player];
            if (playerPowerUps.speedBoosts > 0) {
                playerInventory_SpeedBoost[player] += playerPowerUps.speedBoosts;
            }
        }
        
        // Calculate individual refund amount
        uint256 refundAmount = race.prizePool / race.players.length;
        
        // Refund entry fees
        for (uint256 i = 0; i < race.players.length; i++) {
            payable(race.players[i]).transfer(refundAmount);
        }
        
        emit RaceEnded(raceId, new RaceResult[](0));
    }

    function startRaceExternal(uint256 raceId) external whenNotPaused {
        Race storage race = races[raceId];
        require(race.id > 0, "Race does not exist");
        require(race.isActive && !race.hasEnded, "Race not available for starting");
        require(isParticipating[raceId][msg.sender], "Only race participants can start");
        
        // STRICT: Race must be completely full to start
        RaceType storage raceType = raceTypes[race.raceSize];
        require(race.playerCount == raceType.maxPlayers, "Race must be full to start");
        
        // Calculate all results immediately when race starts
        _calculateRaceResults(raceId);
        
        // Start the race timer
        race.startTime = block.timestamp;
        emit RaceStarted(raceId, race.startTime);
    }

    function withdrawPowerUpRevenue() external onlyOwner {
        uint256 amount = powerUpRevenue;
        require(amount > 0, "No revenue to withdraw");
        
        powerUpRevenue = 0;
        payable(owner()).transfer(amount);
        
        emit PowerUpRevenueWithdrawn(owner(), amount);
    }

    function withdrawAccidentalTokens() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > powerUpRevenue, "No accidental tokens to withdraw");
        
        uint256 amount = balance - powerUpRevenue;
        payable(owner()).transfer(amount);
        
        emit AccidentalTokensWithdrawn(owner(), amount);
    }

    function setDevFeePercent(uint256 _devFeePercent) external onlyOwner {
        require(_devFeePercent <= 20, "Max dev fee is 20%");
        uint256 oldFee = devFeePercent;
        devFeePercent = _devFeePercent;
        emit DevFeeUpdated(oldFee, _devFeePercent);
    }

    function getCritterStats(uint256 critterId) internal view returns (CritterStats memory) {
        // Get stats from MonadCritter contract
        MonadCritter.Stats memory stats = critterContract.getStats(critterId);
        return CritterStats({
            speed: stats.speed,
            stamina: stats.stamina,
            luck: stats.luck
        });
    }

    function calculateCritterScore(
        CritterStats memory stats,
        PowerUps memory powerUps
    ) internal pure returns (uint256) {
        // Base score = Speed * Stamina * (Luck / 100)
        uint256 baseScore = (stats.speed * stats.stamina * stats.luck) / 100;
        
        // Add boost effect (each boost adds BOOST_MULTIPLIER to score)
        uint256 boostScore = powerUps.speedBoosts * BOOST_MULTIPLIER;
        
        return baseScore + boostScore;
    }

    function endRace(uint256 raceId) external whenNotPaused {
        Race storage race = races[raceId];
        require(race.startTime > 0, "Race hasn't started");
        require(!race.hasEnded, "Race already ended");
        require(isParticipating[raceId][msg.sender], "Only race participants can end");
        
        // Just distribute the pre-calculated rewards and mark race as ended
        race.hasEnded = true;
        _distributeStoredRewards(raceId);
        
        emit RaceEnded(raceId, raceEndInfo[raceId].results);
    }

    function _calculateRaceResults(uint256 raceId) internal {
        Race storage race = races[raceId];
        require(race.calculatedResults.length == 0, "Results already calculated");

        uint256 numPlayers = race.players.length;
        RaceScore[] memory scores = new RaceScore[](numPlayers);

        // Calculate scores for each player
        for (uint256 i = 0; i < numPlayers; i++) {
            address player = race.players[i];
            uint256 critterId = race.critterIds[i];
            
            MonadCritter.Stats memory stats = critterContract.getStats(critterId);
            uint256 finalScore = _calculateRaceScore(
                stats,
                race.powerUps[player].speedBoosts
            );

            scores[i] = RaceScore({
                player: player,
                critterId: critterId,
                score: finalScore,
                position: 0
            });
        }

        // Sort and assign positions
        _sortAndAssignPositions(scores);
        
        // Store results
        for (uint256 i = 0; i < scores.length; i++) {
            race.calculatedResults.push(RaceResult({
                player: scores[i].player,
                critterId: scores[i].critterId,
                finalPosition: scores[i].position,
                reward: 0, // Will be set during distribution
                score: scores[i].score
            }));
        }
    }

    function _calculateRaceScore(
        MonadCritter.Stats memory stats,
        uint256 speedBoosts
    ) internal pure returns (uint256) {
        // Get rarity multiplier (1.0, 1.1, 1.25, 1.5)
        uint256[4] memory rarityMultipliers = [uint256(100), 110, 125, 150];
        uint256 rarityMultiplier = rarityMultipliers[uint256(stats.rarity)];
        
        // Weight the stats differently to reduce ties
        // Speed is most important (x1.2), followed by stamina (x1.0), then luck (x0.8)
        uint256 speedWeight = 120;
        uint256 luckWeight = 80;
        
        // Convert uint8 stats to uint256 for calculations
        uint256 speed = uint256(stats.speed);
        uint256 stamina = uint256(stats.stamina);
        uint256 luck = uint256(stats.luck);
        
        // Calculate weighted stats using fixed-point math (18 decimals)
        uint256 weightedSpeed = (speed * speedWeight) / 100;
        uint256 weightedStamina = stamina; // Stamina has weight of 1.0 (100)
        uint256 weightedLuck = (luck * luckWeight) / 100;
        
        // Calculate base score using weighted multiplicative formula
        uint256 baseScore = (weightedSpeed * weightedStamina * weightedLuck) / 10000;
        
        // Add a small luck-based variance (±2% based on luck stat)
        uint256 luckVariance = 100 + ((luck * 4) / 255) - 2;
        baseScore = (baseScore * luckVariance) / 100;
        
        // Apply rarity multiplier
        baseScore = (baseScore * rarityMultiplier) / 100;
        
        // Apply boosts with diminishing returns
        if (speedBoosts > 0) {
            // First boost gives 20% increase
            baseScore = (baseScore * 120) / 100;
            
            // Second boost gives 15% additional increase
            if (speedBoosts > 1) {
                baseScore = (baseScore * 115) / 100;
            }
        }
        
        // Scale the final score
        baseScore = baseScore * 100;
        
        return baseScore;
    }

    function _sortAndAssignPositions(RaceScore[] memory scores) internal pure {
        uint256 numPlayers = scores.length;
        
        // Insertion sort (efficient for small arrays)
        for (uint256 i = 1; i < numPlayers; i++) {
            RaceScore memory key = scores[i];
            int256 j = int256(i) - 1;
            
            while (j >= 0 && scores[uint256(j)].score < key.score) {
                scores[uint256(j + 1)] = scores[uint256(j)];
                j--;
            }
            scores[uint256(j + 1)] = key;
        }
        
        // Assign positions (handling ties)
        uint256 currentPosition = 1;
        uint256 sameScoreCount = 1;
        scores[0].position = currentPosition;
        
        for (uint256 i = 1; i < numPlayers; i++) {
            if (scores[i].score == scores[i-1].score) {
                scores[i].position = currentPosition;
                sameScoreCount++;
            } else {
                currentPosition += sameScoreCount;
                scores[i].position = currentPosition;
                sameScoreCount = 1;
            }
        }
    }

    function _distributeStoredRewards(uint256 raceId) internal {
        Race storage race = races[raceId];
        require(race.calculatedResults.length > 0, "No results to distribute");
        
        // Calculate dev fee
        uint256 devFee = (race.prizePool * devFeePercent) / 100;
        uint256 remainingPrize = race.prizePool - devFee;

        // Transfer dev fee if any
        if (devFee > 0) {
            payable(owner()).transfer(devFee);
        }

        // Get race configuration
        RaceType storage raceType = raceTypes[race.raceSize];
        
        // Distribute rewards based on stored positions
        for (uint256 i = 0; i < race.calculatedResults.length; i++) {
            RaceResult storage result = race.calculatedResults[i];
            if (result.finalPosition <= raceType.numWinners) {
                uint256 reward = (remainingPrize * raceType.rewardPercentages[result.finalPosition - 1]) / 100;
                result.reward = reward; // Store the reward amount
                payable(result.player).transfer(reward);
                
                // Update player stats
                PlayerStats storage winnerStats = playerStats[result.player];
                winnerStats.totalRewards += reward;
                if (result.finalPosition == 1) {
                    winnerStats.wins++;
                }
            }
            
            // Update other player stats
            PlayerStats storage playerStats_ = playerStats[result.player];
            playerStats_.totalScore += result.score;
            playerStats_.racesParticipated++;
            if (result.score > playerStats_.bestScore) {
                playerStats_.bestScore = result.score;
            }
        }
    }

    function _createRaceResults(RaceScore[] memory scores) internal pure returns (RaceResult[] memory) {
        RaceResult[] memory results = new RaceResult[](scores.length);
        for (uint256 i = 0; i < scores.length; i++) {
            results[i] = RaceResult({
                player: scores[i].player,
                critterId: scores[i].critterId,
                finalPosition: scores[i].position,
                reward: 0, // Will be filled in by _distributeRewards
                score: scores[i].score
            });
        }
        return results;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getRaceTypeInfo(RaceSize raceSize) external view returns (RaceTypeInfo memory) {
        RaceType storage raceType = raceTypes[raceSize];
        return RaceTypeInfo({
            maxPlayers: raceType.maxPlayers,
            numWinners: raceType.numWinners,
            entryFee: raceType.entryFee,
            rewardPercentages: raceType.rewardPercentages,
            isActive: raceType.isActive
        });
    }

    function getRaceInfo(uint256 raceId) external view returns (RaceInfo memory) {
        Race storage race = races[raceId];
        return RaceInfo({
            id: race.id,
            raceSize: race.raceSize,
            players: race.players,
            critterIds: race.critterIds,
            startTime: race.startTime,
            isActive: race.isActive,
            hasEnded: race.hasEnded,
            prizePool: race.prizePool
        });
    }

    function getActiveRaces(RaceSize raceSize) external view returns (RaceInfo[] memory) {
        uint256[] storage activeRaces = activeRacesByType[raceSize];
        RaceInfo[] memory raceInfos = new RaceInfo[](activeRaces.length);
        
        for (uint256 i = 0; i < activeRaces.length; i++) {
            Race storage race = races[activeRaces[i]];
            raceInfos[i] = RaceInfo({
                id: race.id,
                raceSize: race.raceSize,
                players: race.players,
                critterIds: race.critterIds,
                startTime: race.startTime,
                isActive: race.isActive,
                hasEnded: race.hasEnded,
                prizePool: race.prizePool
            });
        }
        
        return raceInfos;
    }

    // Add new function to get user's race history
    function getUserRaces(address user) external view returns (RaceInfo[] memory) {
        uint256[] storage userRaces = userRaceHistory[user];
        RaceInfo[] memory raceInfos = new RaceInfo[](userRaces.length);
        
        for (uint256 i = 0; i < userRaces.length; i++) {
            Race storage race = races[userRaces[i]];
            raceInfos[i] = RaceInfo({
                id: race.id,
                raceSize: race.raceSize,
                players: race.players,
                critterIds: race.critterIds,
                startTime: race.startTime,
                isActive: race.isActive,
                hasEnded: race.hasEnded,
                prizePool: race.prizePool
            });
        }
        
        return raceInfos;
    }

    function getLatestAvailableRace(RaceSize raceSize) external view returns (uint256) {
        require(
            raceSize == RaceSize.Two || 
            raceSize == RaceSize.Five || 
            raceSize == RaceSize.Ten, 
            "Invalid race size"
        );
        
        uint256[] storage activeRaces = activeRacesByType[raceSize];
        
        for (uint256 i = 0; i < activeRaces.length; i++) {
            Race storage race = races[activeRaces[i]];
            RaceType storage raceType = raceTypes[raceSize];
            
            if (race.isActive && 
                !race.hasEnded && 
                race.startTime == 0 && 
                race.playerCount < raceType.maxPlayers) {
                return race.id;
            }
        }
        
        return 0; // Return 0 if no available race found
    }

    // Add new view functions at the end of the contract
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    function getWinRate(address player) external view returns (uint256) {
        PlayerStats memory stats = playerStats[player];
        if (stats.racesParticipated == 0) return 0;
        return (stats.wins * 100) / stats.racesParticipated;
    }

    function getTopPlayersByWins(uint256 limit) external view returns (address[] memory, uint256[] memory) {
        // Count total players with stats
        uint256 totalPlayers = 0;
        for (uint256 i = 0; i < races[currentRaceId].players.length; i++) {
            address player = races[currentRaceId].players[i];
            if (playerStats[player].racesParticipated > 0) {
                totalPlayers++;
            }
        }

        // Use the smaller of limit or totalPlayers
        uint256 resultSize = limit < totalPlayers ? limit : totalPlayers;
        address[] memory topPlayers = new address[](resultSize);
        uint256[] memory winCounts = new uint256[](resultSize);

        // Initialize with first players found
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < races[currentRaceId].players.length && currentIndex < resultSize; i++) {
            address player = races[currentRaceId].players[i];
            if (playerStats[player].racesParticipated > 0) {
                topPlayers[currentIndex] = player;
                winCounts[currentIndex] = playerStats[player].wins;
                currentIndex++;
            }
        }

        // Sort by wins (simple bubble sort)
        for (uint256 i = 0; i < resultSize - 1; i++) {
            for (uint256 j = 0; j < resultSize - i - 1; j++) {
                if (winCounts[j] < winCounts[j + 1]) {
                    // Swap wins
                    uint256 tempWins = winCounts[j];
                    winCounts[j] = winCounts[j + 1];
                    winCounts[j + 1] = tempWins;
                    
                    // Swap addresses
                    address tempAddr = topPlayers[j];
                    topPlayers[j] = topPlayers[j + 1];
                    topPlayers[j + 1] = tempAddr;
                }
            }
        }

        return (topPlayers, winCounts);
    }

    function getTopPlayersByScore(uint256 limit) external view returns (address[] memory, uint256[] memory) {
        uint256 totalPlayers = 0;
        for (uint256 i = 0; i < races[currentRaceId].players.length; i++) {
            address player = races[currentRaceId].players[i];
            if (playerStats[player].racesParticipated > 0) {
                totalPlayers++;
            }
        }

        uint256 resultSize = limit < totalPlayers ? limit : totalPlayers;
        address[] memory topPlayers = new address[](resultSize);
        uint256[] memory scores = new uint256[](resultSize);

        uint256 currentIndex = 0;
        for (uint256 i = 0; i < races[currentRaceId].players.length && currentIndex < resultSize; i++) {
            address player = races[currentRaceId].players[i];
            if (playerStats[player].racesParticipated > 0) {
                topPlayers[currentIndex] = player;
                scores[currentIndex] = playerStats[player].totalScore;
                currentIndex++;
            }
        }

        // Sort by total score
        for (uint256 i = 0; i < resultSize - 1; i++) {
            for (uint256 j = 0; j < resultSize - i - 1; j++) {
                if (scores[j] < scores[j + 1]) {
                    uint256 tempScore = scores[j];
                    scores[j] = scores[j + 1];
                    scores[j + 1] = tempScore;
                    
                    address tempAddr = topPlayers[j];
                    topPlayers[j] = topPlayers[j + 1];
                    topPlayers[j + 1] = tempAddr;
                }
            }
        }

        return (topPlayers, scores);
    }
}
