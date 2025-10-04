import json
from collections import Counter
from tqdm import tqdm


def _parse_nodes_generator(file_path):
    """
    A generator that parses the meta file and yields one node at a time.
    This avoids loading the entire file into memory.
    """
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        current_node = {}
        for line in f:
            line = line.strip()

            if line.startswith('Id:'):
                if current_node and 'id' in current_node and 'group' in current_node:
                    yield current_node
                current_node = {'id': line.split(':')[1].strip()}
            elif line.startswith('title:') and 'id' in current_node:
                current_node['title'] = line.split(':', 1)[1].strip()
            elif line.startswith('group:') and 'id' in current_node:
                current_node['group'] = line.split(':')[1].strip()

        # Yield the last node in the file
        if current_node and 'id' in current_node and 'group' in current_node:
            yield current_node


def parse_amazon_meta_optimized(file_path, max_nodes=100):
    """
    Optimized version to find the first 'max_nodes' satisfying the distribution.
    This function operates in a single pass (O(N) complexity).
    """
    print(f"Finding first {max_nodes} nodes with group distribution requirements...")

    selected_nodes = []
    group_counts = Counter()
    total_count = 0

    # Use a generator to parse nodes one by one
    node_generator = _parse_nodes_generator(file_path)

    for node in tqdm(node_generator, desc="Scanning nodes"):
        # Add the new node and update running counts
        selected_nodes.append(node)
        group_counts[node['group']] += 1
        total_count += 1

        # Check conditions only when necessary
        sorted_groups = group_counts.most_common(3)  # Only need top 3 to check

        # Condition 1: Most common group is not more than 40%
        if (sorted_groups[0][1] / total_count) > 0.4:
            continue

        # Condition 2: Second most common group is not more than 30%
        if len(sorted_groups) > 1 and (sorted_groups[1][1] / total_count) > 0.3:
            continue

        # Condition 3: Third most common group is not more than 20%
        # If the third one is valid, all subsequent ones must also be valid.
        if len(sorted_groups) > 2 and (sorted_groups[2][1] / total_count) > 0.2:
            continue

        # If all conditions are met and we have enough nodes, we are done.
        if total_count >= max_nodes:
            print(f"\nFound a suitable prefix of {total_count} nodes. Taking the first {max_nodes}.")
            break

    # Finalize the list of nodes
    final_nodes = selected_nodes[:max_nodes]
    if len(final_nodes) < max_nodes:
        print(f"\nWarning: Only found {len(final_nodes)} nodes that meet the criteria prefix. "
              f"Using these {len(final_nodes)} nodes.")

    # Print final distribution statistics
    final_group_counts = Counter(node['group'] for node in final_nodes)
    print(f"\nGroup distribution for selected {len(final_nodes)} nodes:")
    for group, count in final_group_counts.most_common():
        percentage = (count / len(final_nodes)) * 100
        print(f"  {group}: {count} ({percentage:.1f}%)")

    return final_nodes


def parse_amazon_edges_optimized(file_path, valid_node_ids):
    """
    Optimized version to parse edges without loading the whole file into memory.
    """
    print("\nReading amazon0302.txt...")
    edges = []
    valid_ids = set(valid_node_ids)

    with open(file_path, 'r', encoding='utf-8') as f:
        # Iterate line by line instead of f.readlines() to save memory
        for line in tqdm(f, desc="Processing edges"):
            if line.startswith('#'):
                continue

            parts = line.strip().split()
            if len(parts) == 2:
                source, target = parts[0], parts[1]
                if source in valid_ids and target in valid_ids:
                    edges.append({'source': source, 'target': target})

    print(f"Total valid edges: {len(edges)}")
    return edges


def create_amazon_json_optimized(meta_file, edges_file, output_file, max_nodes=50):
    """
    Main function using optimized parsers.
    修改：group直接使用原始组名，不进行数字转换。
    """
    nodes_data = parse_amazon_meta_optimized(meta_file, max_nodes)
    valid_node_ids = {node['id'] for node in nodes_data}

    id_to_title = {}
    # 移除 group_to_num 和 group_counter
    nodes = []

    for node in nodes_data:
        node_id = node['id']
        title = node.get('title', f"Product_{node_id}")
        # 直接使用原始的 group 字符串
        group = node['group']

        full_id_str = f"{node_id}: {title}"
        id_to_title[node_id] = full_id_str
        nodes.append({
            'id': full_id_str,
            # 将 group 设置为原始字符串
            'group': group
        })

    edges_data = parse_amazon_edges_optimized(edges_file, valid_node_ids)

    links = []
    for edge in edges_data:
        # Check if both source and target are in our map to avoid KeyErrors
        if edge['source'] in id_to_title and edge['target'] in id_to_title:
            links.append({
                'source': id_to_title[edge['source']],
                'target': id_to_title[edge['target']],
                'value': 1
            })

    result = {'nodes': nodes, 'links': links}

    print(f"\nWriting to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Successfully created {output_file}")
    print(f"Nodes: {len(nodes)}, Links: {len(links)}")


if __name__ == "__main__":
    create_amazon_json_optimized(
        meta_file='amazon-meta.txt',
        edges_file='amazon0302.txt',
        output_file='amazon-copurchase-network-visualizer/data_files/amazon.json',
        max_nodes=100
    )